import Header from './shared/components/Header';
import ErrorMessage from './shared/components/ErrorMessage';
import GraphPanel from './features/graph/components/GraphPanel';
import CodePanel from './features/codeViewer/components/CodePanel';
import { useAppStore } from './shared/store/appStore';

function App() {
  const { error, selectedFile } = useAppStore();

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <Header />

      {/* Error Message */}
      {error && (
        <div className="px-6 pt-4">
          <ErrorMessage />
        </div>
      )}

      {/* Full Screen Graph */}
      <div className="flex-1 overflow-hidden relative">
        <GraphPanel />

        {/* Code Overlay Panel - appears on top when node is clicked */}
        {selectedFile && <CodePanel />}
      </div>
    </div>
  );
}

export default App;
