package expo.modules.batteryinfo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.pm.PackageManager
import android.provider.Settings
import java.util.Calendar
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import java.io.ByteArrayOutputStream
import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.net.ConnectivityManager
import android.net.TrafficStats
import android.telephony.TelephonyManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BatteryInfoModule : Module() {
  private var isListening = false
  
  private val batteryReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == Intent.ACTION_BATTERY_CHANGED) {
        val data = getBatteryDataFromIntent(context, intent)
        this@BatteryInfoModule.sendEvent("onBatteryStateChanged", data)
      }
    }
  }

  private fun getBatteryDataFromIntent(context: Context, intent: Intent? = null): Map<String, Any?> {
    val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val currentIntent = intent ?: context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    
    val level = currentIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = currentIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val status = currentIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val health = currentIntent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1
    val plugType = currentIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
    val voltage = currentIntent?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1) ?: -1 // mV
    val temperature = currentIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) ?: -1 // tenths of a degree C
    val cycleCount = currentIntent?.getIntExtra("android.os.extra.CYCLE_COUNT", -1) ?: -1
    
    val currentNow = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) // microamperes
    val capacity = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) // percentage
    val chargeCounter = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER) // microampere-hours
    
    var designCapacity = -1.0
    try {
      val powerProfileClass = Class.forName("com.android.internal.os.PowerProfile")
      val powerProfile = powerProfileClass.getConstructor(Context::class.java).newInstance(context)
      designCapacity = powerProfileClass.getMethod("getBatteryCapacity").invoke(powerProfile) as Double
    } catch (e: Exception) {
      // Ignored
    }

    return mapOf(
      "level" to level,
      "scale" to scale,
      "status" to status,
      "health" to health,
      "plugType" to plugType,
      "voltage" to voltage,
      "temperature" to temperature,
      "cycleCount" to cycleCount,
      "currentNow" to currentNow,
      "chargeCounter" to chargeCounter,
      "capacity" to capacity,
      "designCapacity" to designCapacity
    )
  }

  private fun drawableToBase64(drawable: Drawable): String {
    val bitmap: Bitmap = if (drawable is BitmapDrawable) {
        drawable.bitmap
    } else {
        val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 1
        val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 1
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        bitmap
    }
    
    val scaledBitmap = Bitmap.createScaledBitmap(bitmap, 96, 96, true)
    val outputStream = ByteArrayOutputStream()
    scaledBitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
    return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
  }

  override fun definition() = ModuleDefinition {
    Name("BatteryInfo")

    Events("onBatteryStateChanged")

    Function("getBatteryState") {
      val context = appContext.reactContext ?: return@Function emptyMap<String, Any?>()
      return@Function getBatteryDataFromIntent(context)
    }

    Function("startMonitoring") {
      appContext.reactContext?.let { context ->
        if (!isListening) {
          context.registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
          isListening = true
        }
      }
    }

    Function("stopMonitoring") {
      appContext.reactContext?.let { context ->
        if (isListening) {
          context.unregisterReceiver(batteryReceiver)
          isListening = false
        }
      }
    }

    Function("hasUsagePermission") {
      val context = appContext.reactContext ?: return@Function false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
      return@Function mode == AppOpsManager.MODE_ALLOWED
    }

    Function("requestUsagePermission") {
      appContext.reactContext?.let { context ->
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    AsyncFunction("getNetworkUsageSinceMidnight") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val nsm = context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
      
      val calendar = Calendar.getInstance()
      calendar.set(Calendar.HOUR_OF_DAY, 0)
      calendar.set(Calendar.MINUTE, 0)
      calendar.set(Calendar.SECOND, 0)
      calendar.set(Calendar.MILLISECOND, 0)
      val startTime = calendar.timeInMillis
      val endTime = System.currentTimeMillis()
      
      val uidRx = mutableMapOf<Int, Long>()
      val uidTx = mutableMapOf<Int, Long>()

      try {
          val wifiStats = nsm.querySummary(ConnectivityManager.TYPE_WIFI, null, startTime, endTime)
          val bucket = NetworkStats.Bucket()
          while (wifiStats.hasNextBucket()) {
              wifiStats.getNextBucket(bucket)
              val uid = bucket.uid
              uidRx[uid] = (uidRx[uid] ?: 0) + bucket.rxBytes
              uidTx[uid] = (uidTx[uid] ?: 0) + bucket.txBytes
          }
          wifiStats.close()
      } catch (e: Exception) {}

      try {
          val mobileStats = nsm.querySummary(ConnectivityManager.TYPE_MOBILE, null, startTime, endTime)
          val bucket = NetworkStats.Bucket()
          while (mobileStats.hasNextBucket()) {
              mobileStats.getNextBucket(bucket)
              val uid = bucket.uid
              uidRx[uid] = (uidRx[uid] ?: 0) + bucket.rxBytes
              uidTx[uid] = (uidTx[uid] ?: 0) + bucket.txBytes
          }
          mobileStats.close()
      } catch (e: Exception) {}

      val pm = context.packageManager
      val result = mutableListOf<Map<String, Any>>()
      val processedUids = mutableSetOf<Int>()

      for ((uid, rx) in uidRx) {
          val tx = uidTx[uid] ?: 0L
          if (rx + tx > 0 && !processedUids.contains(uid)) {
              processedUids.add(uid)
              val packages = pm.getPackagesForUid(uid)
              if (packages != null && packages.isNotEmpty()) {
                  val packageName = packages[0]
                  if (pm.getLaunchIntentForPackage(packageName) != null) {
                      var appName = packageName
                      var iconBase64 = ""
                      try {
                          val appInfo = pm.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
                          appName = pm.getApplicationLabel(appInfo).toString()
                          val icon = pm.getApplicationIcon(appInfo)
                          iconBase64 = drawableToBase64(icon)
                      } catch (e: Exception) {}
                      
                      result.add(mapOf(
                          "uid" to uid,
                          "packageName" to packageName,
                          "appName" to appName,
                          "rxBytes" to rx,
                          "txBytes" to tx,
                          "totalBytes" to rx + tx,
                          "iconBase64" to iconBase64
                      ))
                  }
              }
          }
      }
      
      result.sortByDescending { it["totalBytes"] as Long }
      return@AsyncFunction result
    }

    AsyncFunction("getLiveTrafficStats") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val pm = context.packageManager
      
      val installedApps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
      val result = mutableListOf<Map<String, Any>>()
      
      for (appInfo in installedApps) {
          val packageName = appInfo.packageName
          if (pm.getLaunchIntentForPackage(packageName) != null) {
              val uid = appInfo.uid
              val rx = TrafficStats.getUidRxBytes(uid)
              val tx = TrafficStats.getUidTxBytes(uid)
              
              if (rx != TrafficStats.UNSUPPORTED.toLong() && tx != TrafficStats.UNSUPPORTED.toLong()) {
                  var appName = packageName
                  var iconBase64 = ""
                  try {
                      appName = pm.getApplicationLabel(appInfo).toString()
                      val icon = pm.getApplicationIcon(appInfo)
                      iconBase64 = drawableToBase64(icon)
                  } catch (e: Exception) {}
                  
                  result.add(mapOf(
                      "uid" to uid,
                      "packageName" to packageName,
                      "appName" to appName,
                      "rxBytes" to rx,
                      "txBytes" to tx,
                      "iconBase64" to iconBase64
                  ))
              }
          }
      }
      return@AsyncFunction result
    }

    Function("getAppRxBytes") {
      val uid = android.os.Process.myUid()
      val bytes = TrafficStats.getUidRxBytes(uid)
      if (bytes == TrafficStats.UNSUPPORTED.toLong()) {
        return@Function TrafficStats.getTotalRxBytes()
      }
      return@Function bytes
    }

    Function("getAppTxBytes") {
      val uid = android.os.Process.myUid()
      val bytes = TrafficStats.getUidTxBytes(uid)
      if (bytes == TrafficStats.UNSUPPORTED.toLong()) {
        return@Function TrafficStats.getTotalTxBytes()
      }
      return@Function bytes
    }

    AsyncFunction("getNetworkProvider") {
      val context = appContext.reactContext ?: return@AsyncFunction "Unknown"
      try {
          val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
          val operatorName = tm.networkOperatorName
          if (operatorName.isNullOrBlank()) {
              return@AsyncFunction "Wi-Fi"
          }
          return@AsyncFunction operatorName
      } catch (e: Exception) {
          return@AsyncFunction "Unknown"
      }
    }
  }
}
