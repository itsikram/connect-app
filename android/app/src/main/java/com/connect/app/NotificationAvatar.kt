package com.connect.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL

/** Sender profile pictures for notifications. Blocking: call off the main thread. */
object NotificationAvatar {
  private const val TAG = "ConnectFCM"

  /** Downloads [url] and crops it to a circle, or returns null. */
  fun load(url: String?): Bitmap? {
    if (url.isNullOrBlank() || !url.startsWith("http")) return null
    return try {
      val connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 5000
        readTimeout = 5000
      }
      val source = connection.inputStream.use { BitmapFactory.decodeStream(it) } ?: return null
      val size = minOf(source.width, source.height)
      val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply {
          setLocalMatrix(Matrix().apply {
            setTranslate(-(source.width - size) / 2f, -(source.height - size) / 2f)
          })
        }
      }
      Canvas(output).drawCircle(size / 2f, size / 2f, size / 2f, paint)
      output
    } catch (e: Exception) {
      Log.w(TAG, "Failed to load notification avatar", e)
      null
    }
  }
}
