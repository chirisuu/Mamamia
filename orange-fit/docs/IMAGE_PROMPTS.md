# Prompts de imágenes — ORANGE FIT

Las imágenes de las recetas oficiales y de la landing se generan con **ChatGPT** (en tu computadora) y se
suben luego al panel. Este archivo tiene un prompt listo para copiar por cada receta de
`supabase/seed/20_recipes.sql` (36 recetas) y 4 ilustraciones para la landing.

> Las fotos generadas con IA son **ilustrativas**: muestran cómo se ve el plato, no la porción exacta
> del usuario. Recomendación para la UI: rotularlas como "Imagen referencial".

## Especificaciones comunes (recetas)

| Campo | Valor |
|---|---|
| Archivo | `{slug}.webp` (exactamente el slug de la receta) |
| Destino en Storage | bucket `recipe-images`, ruta `official/{slug}.webp` |
| `recipes.image_path` | `official/{slug}.webp` (ruta dentro del bucket) |
| Tamaño final | 1200 × 900 px (4:3), WebP calidad ~80, idealmente < 300 KB |
| Estilo | foto realista, luz natural, fondo neutro cálido, sin texto, logos ni personas, porción realista |

El bucket `recipe-images` es público y acepta `image/*` hasta 10 MB; el staff puede escribir en cualquier
ruta (ver notas de `docs/DATA_MODEL.md`). La convención `official/{slug}.webp` es una propuesta de este
documento: si el panel guarda otra ruta, manda lo que haga el panel.

### Bloque de estilo (ya incluido en cada prompt)

> Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.

## Cómo generarlas y subirlas

1. **Genera** en ChatGPT pegando el prompt de la receta. Si la imagen no sale en 4:3, pide "formato
   horizontal 4:3" de nuevo o recórtala después.
2. **Revisa** antes de usarla: que se parezca a la receta (mismos ingredientes, sin cosas que la receta no
   lleva), sin texto ni letras deformes, sin logos, sin manos ni personas y con una porción realista.
   Si algo no cuadra, pide a ChatGPT que lo corrija o descártala.
3. **Exporta** a WebP de 1200 × 900 (recorta al centro si hace falta). Sirve cualquier editor o un
   conversor web como squoosh.app; nombra el archivo `{slug}.webp`.
4. **Sube** desde el panel: entra a `/admin/recetas`, abre la receta (búscala por título o slug), usa la
   opción para subir o cambiar la imagen y guarda. El panel debe guardar el archivo en
   `recipe-images/official/{slug}.webp` y actualizar `recipes.image_path`.
5. **Comprueba** la ficha pública de la receta y su versión móvil.

Si la pantalla `/admin/recetas` todavía no tiene la subida de imágenes, la alternativa manual (solo staff)
es: Supabase Studio → Storage → `recipe-images` → carpeta `official` → subir `{slug}.webp`, y después en el
editor SQL:

```sql
update public.recipes
set image_path = 'official/{slug}.webp'
where slug = '{slug}' and owner_id is null;
```

## Recetas

### Avena con plátano y chía

- Archivo: `avena-con-platano-y-chia.webp`
- Destino: `recipe-images/official/avena-con-platano-y-chia.webp`
- Tamaño: 1200 × 900 px

```text
Un bowl de avena cocida cremosa con rodajas de plátano encima, semillas de chía espolvoreadas y una pizca de canela; al lado, una rama de canela. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Pan integral con palta y huevo

- Archivo: `pan-integral-con-palta-y-huevo.webp`
- Destino: `recipe-images/official/pan-integral-con-palta-y-huevo.webp`
- Tamaño: 1200 × 900 px

```text
Dos tostadas de pan integral con palta machacada, rodajas de tomate y huevo sancochado en tajadas con la yema firme, sobre un plato plano. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Revuelto de huevos con espinaca

- Archivo: `revuelto-de-huevos-con-espinaca.webp`
- Destino: `recipe-images/official/revuelto-de-huevos-con-espinaca.webp`
- Tamaño: 1200 × 900 px

```text
Huevos revueltos jugosos con espinaca salteada, trocitos de tomate y cebolla roja, en un plato plano, sin pan. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Quinua con manzana

- Archivo: `quinua-con-manzana.webp`
- Destino: `recipe-images/official/quinua-con-manzana.webp`
- Tamaño: 1200 × 900 px

```text
Una taza de cerámica con quinua con manzana caliente: bebida ligeramente espesa color beige claro, granos de quinua y trocitos de manzana visibles, un poco de vapor; junto a la taza, una rama de canela y dos clavos de olor. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Yogurt griego con fresas y chía

- Archivo: `yogurt-griego-con-fresas-y-chia.webp`
- Destino: `recipe-images/official/yogurt-griego-con-fresas-y-chia.webp`
- Tamaño: 1200 × 900 px

```text
Un bowl de yogurt griego blanco y espeso con fresas cortadas en cuartos, chía espolvoreada y un hilo fino de miel. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Panqueques de avena y plátano

- Archivo: `panqueques-de-avena-y-platano.webp`
- Destino: `recipe-images/official/panqueques-de-avena-y-platano.webp`
- Tamaño: 1200 × 900 px

```text
Una pila de tres panqueques pequeños de avena y plátano, dorados, con rodajas de plátano encima; sin jarabe ni crema. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Sánguche de pollo y palta

- Archivo: `sanguche-de-pollo-y-palta.webp`
- Destino: `recipe-images/official/sanguche-de-pollo-y-palta.webp`
- Tamaño: 1200 × 900 px

```text
Un sánguche de pan de molde integral cortado en diagonal que muestra el relleno: pollo deshilachado, palta, una hoja de lechuga y rodajas de tomate. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Saltado de pollo con arroz integral

- Archivo: `saltado-de-pollo-con-arroz-integral.webp`
- Destino: `recipe-images/official/saltado-de-pollo-con-arroz-integral.webp`
- Tamaño: 1200 × 900 px

```text
Saltado de pollo al estilo peruano: tiras de pollo doradas con cebolla roja en gajos, tomate en gajos, tiras de ají amarillo, papa sancochada en bastones y culantro picado; al lado, arroz integral moldeado en forma de cúpula. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Ceviche de pescado con camote y choclo

- Archivo: `ceviche-de-pescado-con-camote-y-choclo.webp`
- Destino: `recipe-images/official/ceviche-de-pescado-con-camote-y-choclo.webp`
- Tamaño: 1200 × 900 px

```text
Ceviche peruano en plato hondo: cubos de pescado blanco marinado en limón con su jugo lechoso, cebolla roja en pluma fina, rocoto picado y culantro; al lado, una rodaja de camote naranja sancochado, choclo andino de granos grandes y una hoja de lechuga. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Arroz con pollo ligero

- Archivo: `arroz-con-pollo-ligero.webp`
- Destino: `recipe-images/official/arroz-con-pollo-ligero.webp`
- Tamaño: 1200 × 900 px

```text
Arroz verde graneado con arvejas, zanahoria en cubitos, granos de choclo y tiras de pimiento rojo, con una pierna de pollo sin piel encima. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Seco de res con frejol canario

- Archivo: `seco-de-res-con-frejol-canario.webp`
- Destino: `recipe-images/official/seco-de-res-con-frejol-canario.webp`
- Tamaño: 1200 × 900 px

```text
Guiso de trozos de carne de res en salsa verde de culantro con zanahoria y arvejas, acompañado de frejol canario guisado color amarillo pálido. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Lentejas con arroz y huevo

- Archivo: `lentejas-con-arroz-y-huevo.webp`
- Destino: `recipe-images/official/lentejas-con-arroz-y-huevo.webp`
- Tamaño: 1200 × 900 px

```text
Lentejas guisadas color marrón con arroz blanco graneado al lado y un huevo frito sobre el arroz, culantro picado por encima. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Tacu tacu con huevo y ensalada

- Archivo: `tacu-tacu-con-huevo-y-ensalada.webp`
- Destino: `recipe-images/official/tacu-tacu-con-huevo-y-ensalada.webp`
- Tamaño: 1200 × 900 px

```text
Tacu tacu dorado en forma de tortilla alargada con un huevo frito encima y, al lado, ensalada de lechuga y tomate. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Sudado de jurel con yuca

- Archivo: `sudado-de-jurel-con-yuca.webp`
- Destino: `recipe-images/official/sudado-de-jurel-con-yuca.webp`
- Tamaño: 1200 × 900 px

```text
Postas de jurel en su jugo de tomate y cebolla con tiras de ají amarillo y hojas de culantro, en plato hondo, con trozos de yuca sancochada al lado. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Quinotto de champiñones

- Archivo: `quinotto-de-champinones.webp`
- Destino: `recipe-images/official/quinotto-de-champinones.webp`
- Tamaño: 1200 × 900 px

```text
Quinua cremosa al estilo risotto con champiñones laminados y dorados y espinaca, con queso fresco rallado por encima, en plato hondo. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Ensalada de quinua con garbanzos y palta

- Archivo: `ensalada-de-quinua-con-garbanzos-y-palta.webp`
- Destino: `recipe-images/official/ensalada-de-quinua-con-garbanzos-y-palta.webp`
- Tamaño: 1200 × 900 px

```text
Bowl de ensalada de quinua con garbanzos, cubos de palta, tomate, pepino, cebolla roja picada y culantro. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Trucha a la plancha con camote

- Archivo: `trucha-a-la-plancha-con-camote.webp`
- Destino: `recipe-images/official/trucha-a-la-plancha-con-camote.webp`
- Tamaño: 1200 × 900 px

```text
Filete de trucha a la plancha con la piel dorada y una rodaja de limón, trozos de camote sancochado y ensalada de lechuga, tomate y pepino. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Tallarines verdes con pollo

- Archivo: `tallarines-verdes-con-pollo.webp`
- Destino: `recipe-images/official/tallarines-verdes-con-pollo.webp`
- Tamaño: 1200 × 900 px

```text
Tallarines con salsa verde de albahaca y espinaca, con tiras de pechuga de pollo a la plancha al lado. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Estofado de pollo con papa

- Archivo: `estofado-de-pollo-con-papa.webp`
- Destino: `recipe-images/official/estofado-de-pollo-con-papa.webp`
- Tamaño: 1200 × 900 px

```text
Estofado de pollo en salsa rojiza de tomate con papa, rodajas de zanahoria y arvejas, en plato hondo. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Chaufa de quinua con pollo

- Archivo: `chaufa-de-quinua-con-pollo.webp`
- Destino: `recipe-images/official/chaufa-de-quinua-con-pollo.webp`
- Tamaño: 1200 × 900 px

```text
Chaufa de quinua salteada con cubos de pollo, tiras de tortilla de huevo, pimiento rojo en cubitos y cebolla china picada. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Saltado de pota

- Archivo: `saltado-de-pota.webp`
- Destino: `recipe-images/official/saltado-de-pota.webp`
- Tamaño: 1200 × 900 px

```text
Tiras de pota salteadas con cebolla roja, tomate, ají amarillo y culantro, con arroz integral al lado. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Causa de atún ligera

- Archivo: `causa-de-atun-ligera.webp`
- Destino: `recipe-images/official/causa-de-atun-ligera.webp`
- Tamaño: 1200 × 900 px

```text
Una porción de causa limeña en capas con corte limpio: papa amarilla prensada de color amarillo intenso, relleno cremoso de atún, láminas de palta y rodajas de huevo sancochado encima. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Solterito arequipeño

- Archivo: `solterito-arequipeno.webp`
- Destino: `recipe-images/official/solterito-arequipeno.webp`
- Tamaño: 1200 × 900 px

```text
Bowl de solterito arequipeño: habas verdes peladas, granos de choclo, cubos de queso fresco blanco, tomate, cebolla roja, rocoto picado, aceitunas negras de botija y culantro. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Sopa de quinua con verduras

- Archivo: `sopa-de-quinua-con-verduras.webp`
- Destino: `recipe-images/official/sopa-de-quinua-con-verduras.webp`
- Tamaño: 1200 × 900 px

```text
Plato hondo de sopa de quinua con cubos de papa, zapallo naranja, zanahoria, vainita y cubos de queso fresco, en un caldo dorado claro. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Caldo de pollo con verduras

- Archivo: `caldo-de-pollo-con-verduras.webp`
- Destino: `recipe-images/official/caldo-de-pollo-con-verduras.webp`
- Tamaño: 1200 × 900 px

```text
Plato hondo de caldo de pollo claro con una presa de pollo, papa, zanahoria, fideos y cebolla china picada. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Ensalada de pollo con palta

- Archivo: `ensalada-de-pollo-con-palta.webp`
- Destino: `recipe-images/official/ensalada-de-pollo-con-palta.webp`
- Tamaño: 1200 × 900 px

```text
Ensalada de lechuga, tomate, pepino y palta con tiras de pechuga de pollo a la plancha encima. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Crema de zapallo

- Archivo: `crema-de-zapallo.webp`
- Destino: `recipe-images/official/crema-de-zapallo.webp`
- Tamaño: 1200 × 900 px

```text
Crema de zapallo naranja, lisa y espesa, en plato hondo, con unos cubos de queso fresco encima. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Caballa al horno con papas

- Archivo: `caballa-al-horno-con-papas.webp`
- Destino: `recipe-images/official/caballa-al-horno-con-papas.webp`
- Tamaño: 1200 × 900 px

```text
Un trozo de caballa al horno con la piel plateada y dorada sobre rodajas de papa, cebolla y tomate asados, en una fuente de cerámica. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Omelette de claras con champiñones

- Archivo: `omelette-de-claras-con-champinones.webp`
- Destino: `recipe-images/official/omelette-de-claras-con-champinones.webp`
- Tamaño: 1200 × 900 px

```text
Omelette de claras doblado por la mitad, relleno de champiñones y espinaca, en plato plano. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Ensalada tibia de lentejas

- Archivo: `ensalada-tibia-de-lentejas.webp`
- Destino: `recipe-images/official/ensalada-tibia-de-lentejas.webp`
- Tamaño: 1200 × 900 px

```text
Bowl de ensalada de lentejas con cubos de tomate, pepino, pimiento rojo, cebolla roja y culantro. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Saltado de tofu con verduras

- Archivo: `saltado-de-tofu-con-verduras.webp`
- Destino: `recipe-images/official/saltado-de-tofu-con-verduras.webp`
- Tamaño: 1200 × 900 px

```text
Cubos de tofu dorados salteados con floretes de brócoli, tiras de pimiento rojo y cebolla, con brillo ligero de sillao; arroz integral al lado. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Fruta con yogurt y linaza

- Archivo: `fruta-con-yogurt-y-linaza.webp`
- Destino: `recipe-images/official/fruta-con-yogurt-y-linaza.webp`
- Tamaño: 1200 × 900 px

```text
Bowl con cubos de papaya y piña sobre yogurt natural, con linaza molida espolvoreada. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Batido de plátano y maní

- Archivo: `batido-de-platano-y-mani.webp`
- Destino: `recipe-images/official/batido-de-platano-y-mani.webp`
- Tamaño: 1200 × 900 px

```text
Un vaso alto con batido cremoso color beige claro; al lado, medio plátano y una cucharada de mantequilla de maní en un platito. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Hummus con palitos de verduras

- Archivo: `hummus-con-palitos-de-verduras.webp`
- Destino: `recipe-images/official/hummus-con-palitos-de-verduras.webp`
- Tamaño: 1200 × 900 px

```text
Bowl de hummus de garbanzo cremoso con un hilo de aceite de oliva, rodeado de bastones de zanahoria y pepino. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Pudín de chía con mango

- Archivo: `pudin-de-chia-con-mango.webp`
- Destino: `recipe-images/official/pudin-de-chia-con-mango.webp`
- Tamaño: 1200 × 900 px

```text
Un vaso de vidrio con pudín de chía, cubierto con cubos de mango. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

### Choclo con queso

- Archivo: `choclo-con-queso.webp`
- Destino: `recipe-images/official/choclo-con-queso.webp`
- Tamaño: 1200 × 900 px

```text
Un choclo andino sancochado entero, de granos grandes color blanco amarillento, con dos tajadas de queso fresco blanco al lado, en plato plano. Fotografía gastronómica realista, formato horizontal 4:3. Luz natural suave de ventana lateral, sombras suaves. Fondo neutro cálido: mesa de madera clara y mantel de lino beige. Vajilla de cerámica artesanal color crema. Vista a 45 grados. Porción realista para una persona, colores naturales sin saturar. Sin texto, sin logos, sin marcas, sin personas ni manos, sin ingredientes que no estén descritos.
```

## Landing (4 ilustraciones de marca)

Ilustraciones **abstractas** en naranja: no son capturas de la app ni mockups de teléfono con datos
inventados. Destino sugerido: `public/images/landing/{archivo}.webp` (lo decide quien implemente la landing).
Revisa que no aparezcan letras, números ni pantallas aunque el prompt lo prohíba.

### Portada (hero)

- Archivo: `landing-hero-abstract.webp`
- Tamaño: 1600×1200 (4:3)

```text
Ilustración abstracta de marca, estilo plano con textura de grano suave. Formas orgánicas superpuestas en naranja vivo, durazno y crema que sugieren frutas, hojas y granos sin dibujarlos de forma literal. Mucho espacio vacío a la derecha para poner un titular encima. Sin texto, sin logos, sin pantallas de celular, sin interfaces de app, sin personas.
```

### Sección "Registra lo que comes"

- Archivo: `landing-registro-abstract.webp`
- Tamaño: 1200×900 (4:3)

```text
Ilustración abstracta de marca: un círculo que evoca un plato visto desde arriba, rodeado de formas suaves en naranja, verde hoja y crema que recuerdan alimentos; trazos simples y redondeados, fondo crema. Sin texto, sin números, sin interfaces de app, sin personas.
```

### Sección "Recetas y planes"

- Archivo: `landing-recetas-abstract.webp`
- Tamaño: 1200×900 (4:3)

```text
Composición abstracta en naranja y crema con siluetas geométricas muy simplificadas de productos peruanos (una palta partida, aguaymantos, un choclo, una hoja de culantro), estilo papel recortado con sombras suaves. Sin texto, sin logos, sin personas.
```

### Sección "Tu progreso"

- Archivo: `landing-progreso-abstract.webp`
- Tamaño: 1200×900 (4:3)

```text
Ilustración abstracta de curvas suaves y ondas ascendentes en degradado de naranja a durazno sobre fondo crema, que sugieren avance constante. Sin ejes, sin números, sin texto, sin gráficos que parezcan datos reales, sin interfaces de app.
```
