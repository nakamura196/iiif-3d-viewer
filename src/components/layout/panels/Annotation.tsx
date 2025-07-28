'use client';

import { useAtom } from 'jotai';
import { infoPanelAtom } from '@/atoms/infoPanelAtom';

const Detail = () => {
  const [infoPanelContent] = useAtom(infoPanelAtom);

  return (
    <div className="metadata-container" style={{ padding: '20px' }}>
      {/* タイトルセクション */}
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
        {infoPanelContent?.title || 'No Title'}
      </div>

      {/* 説明セクション */}
      <div style={{ marginBottom: '20px' }}>
        <div
          dangerouslySetInnerHTML={{ __html: infoPanelContent?.description || 'No description' }}
        />
      </div>
    </div>
  );
};

export default Detail;
