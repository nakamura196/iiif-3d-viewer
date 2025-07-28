'use client';

import CanvasComponent from '@/components/three/Canvas';

const Viewer = ({ manifestUrl }: { manifestUrl: string }) => {

  return (
    <div className="w-full h-full">
      <CanvasComponent glbUrl={manifestUrl} />
    </div>
  );
};

export default Viewer;
