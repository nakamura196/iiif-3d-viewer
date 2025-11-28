# Annotation Display Performance Improvement

## Overview

When there are many annotations in the 3D viewer, the occlusion detection (Raycast) process becomes a performance bottleneck. This document explains the improvement techniques adopted.

## Problem

Annotation occlusion detection requires executing Raycast (ray-mesh collision detection) for each annotation. This process becomes heavy for the following reasons:

- Collision detection with all mesh vertices is required
- Computation increases proportionally with the number of annotations
- Running every frame makes it difficult to maintain 60 FPS

## Solution: Raycast Execution Only When Idle

We adopted an approach that **executes Raycast processing only when the camera stops**.

### Operation Flow

```
Camera moving → Skip Raycast processing (lightweight)
    ↓
Camera stop detected
    ↓
Wait 10 frames (stabilization)
    ↓
Execute Raycast once
    ↓
No recalculation until camera moves again
```

### Implementation Details

```typescript
// Performance settings
const CAMERA_MOVE_THRESHOLD = 0.001; // Camera movement threshold
const IDLE_FRAMES_BEFORE_RAYCAST = 10; // Frames to wait after stopping before Raycast

useFrame(() => {
  // Check camera movement
  const cameraMoved = camera.position.distanceTo(prevCameraPosition) > CAMERA_MOVE_THRESHOLD;
  prevCameraPosition.copy(camera.position);

  if (cameraMoved) {
    // Reset counter while camera is moving
    idleFrameCountRef.current = 0;
    needsRaycastRef.current = true;
    return; // Skip Raycast processing
  }

  // Camera is stopped
  idleFrameCountRef.current++;

  // Execute Raycast once after waiting certain frames after stopping
  if (!needsRaycastRef.current) return;
  if (idleFrameCountRef.current < IDLE_FRAMES_BEFORE_RAYCAST) return;

  // Execute Raycast (only once)
  needsRaycastRef.current = false;

  // ... Raycast processing ...
});
```

### Two-Stage Detection Process

The Raycast processing itself is also optimized:

1. **First Pass (lightweight)**: Frustum detection + Camera direction check
   - Early exclusion of annotations outside the view
   - Low computation cost

2. **Second Pass (heavy)**: Raycast detection
   - Only targets annotations that passed the first pass
   - Executes collision detection with meshes

## Benefits

| Item | Traditional Method | After Optimization |
|------|-------------------|-------------------|
| Raycast frequency | Every frame or every 15 frames | Only when camera stops |
| Load during drag | High | Almost zero |
| Occlusion detection accuracy | Always accurate | Accurate after stopping |

## Is This a Common Technique?

Yes. This "**Idle-time processing**" pattern is widely used in the following applications:

- **Google Maps**: Low resolution during drag, high resolution tile loading after stopping
- **3D Viewers**: Simple display during movement, detailed calculation after stopping
- **Text Editors**: Delay syntax highlighting during input

## Limitations

- During camera movement, occlusion detection is not updated, so there may be temporarily inaccurate display
- However, it updates immediately after stopping, so there are no practical issues

## Related Files

- `src/components/three/Annotations.tsx` - Occlusion detection logic
- `src/components/three/AnnotationMarker.tsx` - Annotation marker display
