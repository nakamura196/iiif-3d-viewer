import { useAtom } from 'jotai';
import { infoPanelAtom } from '@/atoms/infoPanelAtom';

const Detail = () => {
  const [infoPanelContent] = useAtom(infoPanelAtom);

  return (
    <div className="p-5">
      {/* タイトルセクション */}
      <div className="text-2xl font-bold mb-5 text-gray-900 dark:text-gray-100">
        {infoPanelContent?.title || 'No Title'}
      </div>

      {/* 説明セクション */}
      <div className="mb-5">
        <div
          className="text-gray-800 dark:text-gray-200"
          dangerouslySetInnerHTML={{ __html: infoPanelContent?.description || 'No description' }}
        />
      </div>
    </div>
  );
};

export default Detail;
