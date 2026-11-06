# Videos de TikTok

Sigue una cuenta de TikTok (por defecto [@claudesinpermiso](https://www.tiktok.com/@claudesinpermiso))
y te avisa cada vez que sube un video nuevo.

## Cómo funciona

1. **Cada 3 horas** GitHub corre `revisar.py` solo (`.github/workflows/tiktok.yml`). El script lee los
   videos de la cuenta y los guarda en `videos.json`.
2. **Por cada video nuevo** abre un *issue* en este repositorio con el enlace al video. GitHub te
   lo notifica por correo y en la app de GitHub del celular, así que te llega como un aviso.
   Ciérralo cuando lo hayas visto.
3. **La página** (`index.html`) muestra todos los videos guardados, con buscador y una etiqueta
   **NUEVO** en los que llegaron después de tu primera visita y todavía no abriste. Al tocar uno se
   reproduce ahí mismo con el reproductor oficial de TikTok. La pestaña **Perfil en vivo** carga la
   inserción oficial del perfil, que siempre muestra lo más reciente aunque la revisión automática
   haya fallado.

La primera revisión solo guarda lo que ya existe: no te avisa de todo el historial de golpe.

## Ponerlo en marcha

1. Estos archivos tienen que estar en la rama principal (`main`): GitHub solo corre las tareas
   programadas desde ahí.
2. **Settings → Pages → Deploy from a branch → `main` / root.** La página queda en
   `https://<tu-usuario>.github.io/<repo>/tiktok/`. Ábrela en el celular y usa
   **Agregar a pantalla de inicio**.
3. **Actions → Revisar TikTok → Run workflow** para hacer la primera revisión sin esperar 3 horas.
4. Para recibir los avisos en el celular: instala la app de GitHub y activa las notificaciones.
   Como dueño del repositorio ya lo estás "mirando".

## Seguir otra cuenta

Cambia `CUENTA` al principio de `revisar.py` (y `CUENTA_POR_DEFECTO` en `index.html`, que solo se
usa mientras no hay lista). Al cambiar de cuenta la lista empieza de cero.

## Si deja de funcionar

TikTok bloquea a veces las revisiones automáticas. El script prueba dos fuentes (yt-dlp y la página
pública de inserción) y, si las dos fallan, conserva los videos que ya tenía y la página lo avisa.
Normalmente se arregla solo en la siguiente revisión, porque cada vez se instala la última versión
de yt-dlp. Mientras tanto, **Perfil en vivo** sigue funcionando.

Para probarlo en tu equipo:

```sh
pip install "yt-dlp[default,curl-cffi]"
python tiktok/revisar.py
```
