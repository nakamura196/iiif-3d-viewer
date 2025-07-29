# IIIF Manifests

This directory contains IIIF Presentation API 3.0 manifests for the 3D viewer.

## Sample Manifests

- `sample-manifest.json` - 石淵家地球儀 (Ishibuchi Family Globe)
- `sample-manifest-with-annotations.json` - 石淵家地球儀 (Ishibuchi Family Globe) - With Annotations

## Adding New Manifests

To add a new manifest:

1. Create a new JSON file in this directory
2. Ensure the 3D model file is placed in `/public/models/`
3. Update the model URL in the manifest to use the local path (e.g., `/models/your-model.glb`)
4. Update internal IDs to use relative paths