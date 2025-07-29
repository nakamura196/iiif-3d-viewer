# IIIF 3D Viewer: A New Approach to Utilizing 3D Materials in Digital Humanities

## Introduction

In the field of Digital Humanities, the 3D digitization of cultural properties and historical materials is rapidly advancing. However, to utilize 3D models not just for viewing but for academic analysis and education, appropriate tools are necessary. This article introduces the "IIIF 3D Viewer," a 3D model viewer compliant with the IIIF (International Image Interoperability Framework) standard.

## What is IIIF 3D Viewer?

IIIF 3D Viewer is a web application that displays 3D models based on the IIIF Manifest format and provides annotation functionality. Developed by researchers at The University of Tokyo, it is released as open-source software.

### Key Features

1. **Standards Compliance**
   - Compliant with IIIF Presentation API 3.0
   - Compatibility with existing IIIF ecosystem

2. **Interactive 3D Display**
   - Support for GLB/GLTF formats
   - Intuitive control via mouse and touch operations
   - High-speed rendering utilizing WebGL

3. **Annotation Functionality**
   - Add annotations to any point on 3D models
   - Spatial coordinate recording via 3DSelector type
   - Enable academic annotations and explanations

4. **Multi-language Support**
   - Japanese and English interfaces
   - Designed for international research projects

5. **Static Site Generation**
   - Utilizes Next.js static export functionality
   - Easy hosting on GitHub Pages, Netlify, etc.

## Technical Implementation

### Architecture

The application is built with the following technology stack:

- **Frontend Framework**: Next.js 15 (App Router)
- **3D Rendering**: React Three Fiber + Three.js
- **Internationalization**: next-intl
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript

### IIIF Manifest Structure

Example of IIIF Manifest containing 3D models:

```json
{
  "@context": "http://iiif.io/api/presentation/3/context.json",
  "id": "https://example.com/manifest.json",
  "type": "Manifest",
  "label": { "en": ["Ishibuchi Family Globe"] },
  "items": [
    {
      "id": "https://example.com/canvas/1",
      "type": "Canvas",
      "items": [
        {
          "id": "https://example.com/annotationpage/1",
          "type": "AnnotationPage",
          "items": [
            {
              "id": "https://example.com/annotation/1",
              "type": "Annotation",
              "motivation": "painting",
              "body": {
                "id": "https://example.com/model.glb",
                "type": "Model",
                "format": "model/gltf-binary"
              },
              "target": "https://example.com/canvas/1"
            }
          ]
        }
      ]
    }
  ]
}
```

### Annotation Implementation

Annotations in 3D space are represented with the following structure:

```json
{
  "type": "Annotation",
  "body": {
    "value": "This section shows 18th century Japanese geographical understanding",
    "label": "Depiction of Japanese archipelago"
  },
  "target": {
    "selector": {
      "type": "3DSelector",
      "value": [0.5, 1.2, -0.3],
      "area": [0.1, 0.1, 0.1],
      "camPos": [2.0, 1.5, 3.0]
    }
  }
}
```

## Use Cases

### 1. Digital Archives of Cultural Properties

Can be utilized for digital publication of three-dimensional cultural properties (globes, sculptures, architectural models, etc.) held by museums and libraries. By adding detailed explanations by researchers as annotations beyond mere 3D display, educational value can be enhanced.

### 2. Archaeological Research

Multiple researchers can collaboratively add annotations to 3D models of excavated artifacts, sharing discovery details and interpretations.

### 3. Architectural History Research

For 3D models of historical buildings, architectural features and historical transitions can be recorded as annotations and utilized as virtual tours.

## Future Prospects

IIIF 3D Viewer is expected to develop in the following directions:

1. **Feature Expansion**
   - Comparative display of multiple 3D models
   - Collaborative editing of annotations
   - VR/AR support

2. **Contribution to Standardization**
   - Participation in IIIF 3D Technical Specification Group
   - Establishment of best practices for 3D content

3. **Community Building**
   - Knowledge sharing among user institutions
   - Development of plugins and extensions

## Conclusion

IIIF 3D Viewer is a tool that brings new possibilities to the utilization of 3D materials in Digital Humanities. Compliance with standards facilitates integration with existing digital archive systems, providing value in both research and education.

As it is released as an open-source project, feedback and contributions from the community are welcome. We look forward to the participation of researchers and technicians interested in the digital utilization of 3D materials.

## Reference Links

- [IIIF 3D Viewer Demo Site](https://3d-iiif-viewer.vercel.app)
- [GitHub Repository](https://github.com/nakamura196/iiif-3d-viewer)
- [IIIF Official Website](https://iiif.io/)

---

*This article is based on information as of January 2025.*