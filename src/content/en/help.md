# Help

IIIF Kasane is a viewer that reads IIIF manifests and displays the resources they describe. It shows 3D models, images, audio and video, together with their annotations, on a single screen. This page explains how to open a resource, how the screen is laid out, how to operate the viewer, and what to check when something does not display.

## Opening a resource

### Enter a manifest URL

Type the URL of a IIIF manifest into the box on the top page and press "View". The viewer opens and shows the resource.

Kasane displays Presentation API 4.0 (draft) and 3.0 manifests. Version 2.0 manifests are converted to the newer form when they are loaded.

If you enter the URL of a Collection, a list of its items appears. Choose an item to open it. When the items have dates (navDate), you can sort them by date or see them on a timeline.

### Start from the samples and use cases

To try Kasane quickly, open one of the prepared examples.

- [Use cases](../usecases/): examples of Kasane used with real collections. Watch the video, then press "Open in Kasane" to open the same resource.
- [Samples](../samples/): recipes from the IIIF Cookbook and test manifests of this site, grouped by image, audio, video and 3D. Press "Open in viewer" to check how each one displays.

### Open from a URL

You can write the resource to open into the viewer URL. This is useful for links you send to others, or for pointing to a resource from a paper or a web page.

- `/en/viewer/?iiif-content=<manifest URL>` opens that resource.
- `iiif-content` also accepts a IIIF Content State (the IIIF standard for pointing to a place inside a resource). If it points to a page, a region of an image, or a time in audio or video, Kasane opens that place and highlights it. If it points to several pages, they are shown side by side.
- Add `&canvas=3` to start on the third page. Pages are counted from 1. You can also give the page URI (the Canvas id).
- Add `&tab=map`, for example, to open with that tab selected in the panel on the right.
- The older form `?manifest=<URL>` still works. Kasane also reads `?curation=<URL>` and `&pos=<number>`, as used by IIIF Curation Viewer.

### Open the compare page from a URL

The compare page (`/en/compare/`) lets you compare images of different resources, even ones held by different institutions.

- Repeat `src=` for each thing to compare: `?src=<URL>&src=<URL>`. Each URL is a manifest or the info.json of a single image (IIIF Image API image information). You can mix the two.
- Give a Collection as `?iiif-content=<URL>`; all its manifests are read. You can add `src=` after it.
- The images of everything you give are put in one list, in order. `&a=0&b=1` says which items of that list are shown as A and B, counting from 0.
- `&mode=` chooses the view: `side` (side by side), `swipe`, `spyglass` or `overlay`. Add `&dir=v` for a horizontal swipe divider.
- Encode the URLs (`/` as `%2F`, `:` as `%3A`). An info.json URL that already contains `%2F` becomes `%252F`.
- Adding or removing items under "Sources" on the page updates `src=` in the URL. The easiest way is to build the comparison on the page and then copy its URL.

Example: compare the manifests of the National Archives of Japan and Stanford University Libraries with a swipe

```
/en/compare/?src=https%3A%2F%2Fwww.digital.archives.go.jp%2Fapi%2Fiiif%2F764297%2Fmanifest.json&src=https%3A%2F%2Fpurl.stanford.edu%2Fhs631zg4177%2Fiiif%2Fmanifest&a=0&b=1&mode=swipe
```

Example: compare a manifest with the info.json of a single image

```
/en/compare/?src=https%3A%2F%2Fwww.digital.archives.go.jp%2Fapi%2Fiiif%2F764297%2Fmanifest.json&src=https%3A%2F%2Fstacks.stanford.edu%2Fimage%2Fiiif%2Fhs631zg4177%252Fhs631zg4177_00_0001%2Finfo.json&a=0&b=1&mode=swipe
```

### Drop a link

Once a resource is open, you can drag another link and drop it on the viewer to open it. You can drop a manifest URL or a link that contains `iiif-content=`. If the link points to a place in the resource that is already open, the viewer moves to that page.

## The screen

The viewer screen has a display area on the left and an information panel on the right.

- Drag the border between them to change the width of the panel. Double-click the border to restore the width.
- A button closes and reopens the panel. On a smartphone the panel sits below the display area, and you can change its height.
- "Download" at the top of the screen opens the file of the manifest you are viewing.
- Buttons at the top switch the language (日本語 / English) and the light or dark theme.

### Tabs of the information panel

The panel shows tabs according to the content of the resource. A tab with nothing to show does not appear.

- **About**: the information written in the manifest, such as title, description, metadata, provider and related links.
- **Pages**: shown for resources with two or more pages. Choose a page from the thumbnails.
- **Contents**: shown when the resource has a table of contents (Ranges). Click an entry to go to that page or place. When the resource offers more than one page order, you switch it here.
- **Layers**: shown when several images are stacked on one page. You can show or hide each image, change the stacking order and the opacity, and play the images one after another.
- **Map**: shown for resources with place information. The place of the current page is red and the other places are blue. Click a place on the map or in the list to go to its page.
- **Rights**: shown when a licence or a required statement is given.
- **Transcript**: shown when audio or video has captions or a transcript.
- **Annotation transcript**: shown when a transcript is given in the form of annotations.
- **Annotations** (for images, audio and video): a list of the annotations on the current page.
- **Annotations** (for 3D): a list of the annotations on the 3D model, with search by words and filtering by tags.
- **Inference**: shown for image pages. It reads the text in the image inside your browser (see below).

## Controls

### Images

- Scroll the mouse wheel to zoom in and out.
- Drag to move the view.
- Double-click to return to the initial view.
- When a page offers a choice of images (Choice), a selector appears. Press "Compare" to open a page that shows two of them side by side.

### Moving between pages

- Use "Previous" and "Next" in the display area.
- On the keyboard, use the left and right arrow keys. For resources read from right to left, the direction is reversed.
- The up and down arrow keys and Page Up / Page Down also move back and forward.
- Home goes to the first page and End to the last.
- To use the keyboard, click the display area once first.

### 3D models

- Drag with the left mouse button to rotate the model.
- Scroll the wheel to zoom in and out.
- Drag with the right mouse button to move the view sideways.
- On a smartphone, rotate with one finger, and zoom or move with two fingers.
- The "+" and "−" buttons at the top right also zoom.
- "Rotate" keeps the model turning. "Fit" brings the whole model into view, and "Top" looks from straight above.
- If the manifest defines viewpoints (cameras), a button appears for each of them. Press one to move to that viewpoint.
- For animated models, "Play" and "Pause" start and stop the animation.
- When several models are placed at the same position, you can switch between them. "Compare" opens a page where you can put two models side by side, or compare them with a swipe, a spyglass or an overlay.

### Audio and video

- Press the play button to play.
- Captions and transcripts, if any, appear in the information panel.
- A page that combines several media plays them together.

## Annotations

Annotations are shown on top of the resource.

- On a 3D model, each annotation is shown as a marker. Click a marker to move the view to that place and show its content.
- Choosing an annotation in the "Annotations" list also moves to that place. The list also has a switch to show or hide the annotations.
- On images, annotations are shown as regions or points. On audio and video, they are shown as times.
- Several annotations on the same place are grouped together.
- Kasane is a viewer for annotations. It has no function for writing and saving new annotations.

## Inference (reading text)

The "Inference" tab reads the text in the image you are viewing. It uses OCR models published by the National Diet Library of Japan. You can choose "NDL Kotenseki OCR-Lite" for classical Japanese books in cursive script, or "NDLOCR-Lite" for modern printed text.

1. Choose a model and press "Download". The model is saved in your browser the first time only. It is about 80 to 160 MB.
2. Press "Run on this image".
3. The result is shown on the image as annotations. You can save it as annotations (JSON) or as plain text.

The image is not sent anywhere. All reading happens inside your browser. The result is a machine estimate and contains errors. Cropped or rotated images are not supported yet.

## Other pages

- [Search collections and curations](../search/): enter the URL of a Collection or a curation to get a list of its items that you can filter by metadata.
- Map and image (`/en/georef/?iiif-content=<URL>`): shows a georeferenced image next to a map. When the image has control points, it can be laid over the map.
  The map's zoom and centre (`mapZoom`, `mapLat`, `mapLng`), the image's zoom and centre (`zoom`, `centerX`, `centerY`), the image's rotation (`rotation`, degrees, counter-clockwise) and the selected place (`id`) are written into the URL as you move around, so the URL opens the same view. The parameter names are the same as in the IIIF Georeference Viewer (geo.ldas.jp), so the part after `?` of its links works here too (`u=` for the manifest is read as well). Add `&lat=<latitude>&lng=<longitude>` to open with a marker at that point.
  With two or more places, the image is turned on opening so that north is up (a `rotation` in the URL opens it at that angle instead). The "Rotation" button above the image changes the angle, turns north up again, or resets it to 0°.
  The list on the right finds places by name, alternative name, ID and tag (katakana and hiragana, and full- and half-width characters, are treated alike). When the places have tags, click a tag under the search box to show only the places with it.
  When a manifest has two or more images with places, switch between them with “‹ ›” under the image. The image shown is written into the URL as `canvas` (the Canvas id, or its position in the manifest).
  At the top right of the map you can switch the base map (standard, GSI pale map, GSI aerial photo, Rekichizu), search for a place name to move there with a marker (using OpenStreetMap Nominatim), and press the target button to go to your current location (the browser asks for permission).

## Sharing a link

To share a resource, send the viewer URL as it is. The URL contains the resource you opened and the tab you selected.

The URL does not change when you move to another page. To point to a particular page, add `&canvas=<page number>` to the end of the URL. To point to a region or a time within a page, use a IIIF Content State (see "Open from a URL").

## When something does not display

### "Could not load the manifest"

First check that the URL is correct. Open the URL directly in your browser and see whether JSON is shown.

If the JSON is shown but Kasane cannot open it, the cause is often CORS. CORS is a server setting that decides whether pages of other sites may read its data. Kasane reads the manifest directly from your browser. If the manifest server does not allow reading from other sites, the browser blocks the request. Kasane cannot work around this. Please ask the provider of the resource to enable CORS.

### Images do not appear

The image server may be down, or the image URL may be wrong. The message "This image is not available" means the image could not be retrieved.

### You are asked to log in

For images protected by IIIF authentication (Authorization Flow API 2.0), a "Log in" prompt appears over the image. Pressing it opens the login page of the provider. If you log in and have permission to view, the image is shown.

- If your browser blocks cookies of other sites, the image may still not appear after you log in.
- Authentication is supported for images only. It is not supported for audio, video or 3D models.

### "This kind of content cannot be displayed"

The content is of a kind that Kasane cannot handle yet. For 3D, Kasane supports models in GLB format and point clouds.

### Inference says the image could not be loaded

The image server may not allow reading from other sites, for the same reason as CORS above. An image can be displayed and still be unavailable for reading text.

## Contact

Please send bug reports and requests to [GitHub Issues](https://github.com/nakamura196/iiif-kasane/issues). Including the URL of the manifest that caused the problem helps us find the cause.
