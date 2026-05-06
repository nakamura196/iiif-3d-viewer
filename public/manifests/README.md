# IIIF Manifests

This directory contains IIIF Presentation API 4.0 (3D TSG) manifests for the 3D viewer.

Legacy Presentation 3.0 manifests with the project's custom `3DSelector` /
`camPos` extension are accepted at runtime and converted to v4 in-memory by
`src/lib/services/manifestConverter.ts`. New manifests should be authored in
v4 form directly (Scene, PointSelector / WKTSelector, PerspectiveCamera).

## Sample Manifests

- `sample-manifest.json` - 石淵家地球儀 (Ishibuchi Family Globe)
- `sample-manifest-with-annotations.json` - 石淵家地球儀 (Ishibuchi Family Globe) - With Annotations

## Adding New Manifests

To add a new manifest:

1. Create a new JSON file in this directory
2. Ensure the 3D model file is placed in `/public/models/`
3. Update the model URL in the manifest to use the local path (e.g., `/models/your-model.glb`)
4. Update internal IDs to use relative paths