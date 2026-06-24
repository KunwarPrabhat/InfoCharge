package expo.modules.batteryinfo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
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
  }
}
