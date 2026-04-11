import { LocalLogViewer } from "@/components/LocalLogViewer";

const LogView = () => {
  const logFile = {
    name: "log.txt",
    size: "644 bytes",
    modified: "Aug 16 09:13",
    type: 'info' as const
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <LocalLogViewer 
      logFile={logFile} 
      onBack={handleBack} 
    />
  );
};

export default LogView;




