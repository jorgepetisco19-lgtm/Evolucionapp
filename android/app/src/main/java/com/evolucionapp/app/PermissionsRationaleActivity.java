package com.evolucionapp.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Health Connect (Android) la abre cuando el usuario pulsa «política de privacidad» en la pantalla de permisos.
 * Muestra la misma política que la ficha de Google Play: abre privacidad.html en el navegador y se cierra.
 */
public class PermissionsRationaleActivity extends Activity {
    private static final String POLICY_URL = "https://jorgepetisco19-lgtm.github.io/Evolucionapp/privacidad.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(POLICY_URL)));
        } catch (Exception ignored) {
            // Sin navegador instalado no hay nada más que hacer.
        }
        finish();
    }
}
