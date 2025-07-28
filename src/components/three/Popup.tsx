const Popup = ({ content }: { content: string }) => {
  return (
    <div className="absolute left-8 top-0 z-10">
      <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg">
        <div className="text-sm text-gray-800">{content}</div>
      </div>
      {/* <div className="px-2 py-1 rounded bg-white dark:bg-gray-800 shadow-lg">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {number}. {content}
            </div>
          </div> */}
    </div>
  );
};

export default Popup;
