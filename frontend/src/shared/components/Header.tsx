import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { graphService } from '../../features/graph';


const Header = () => {
  const [url, setUrl] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(''); // ✅ Preset folders
  const [customFolder, setCustomFolder] = useState(''); // ✅ NEW: Custom folder input
  const { loading, setRepository, setError, setLoading } = useAppStore();


  const handleLoadRepo = async () => {
    // Validate URL
    if (!url.trim()) {
      setError({ message: 'Please enter a GitHub URL', type: 'validation' });
      return;
    }


    if (!graphService.isValidGitHubUrl(url)) {
      setError({ message: 'Invalid GitHub URL format', type: 'validation' });
      return;
    }


    // Parse URL
    const parsed = graphService.parseGitHubUrl(url);
    if (!parsed) return;

    // ✅ NEW: Determine which folder to use
    const folderToAnalyze = selectedFolder === 'custom' ? customFolder : selectedFolder;


    try {
      setError(null);
      setLoading({ cloning: true });


      // Clone repository
      console.log('Cloning repository:', url, folderToAnalyze ? `(folder: ${folderToAnalyze})` : '');
      const cloneResult = await graphService.cloneRepository(url, folderToAnalyze); // ✅ UPDATED
      console.log('Clone result:', cloneResult);


      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone repository');
      }


      // Set repository in store
      setRepository({
        owner: parsed.owner,
        name: parsed.name,
        url: url,
      });


      setLoading({ cloning: false, loadingGraph: true });


      // Load graph data
      const graphData = await graphService.getGraph(parsed.owner, parsed.name, folderToAnalyze); // ✅ ADD folder parameter
      
      useAppStore.setState({ graphData: graphData.graph });
      setLoading({ loadingGraph: false });


    } catch (error: any) {
      setError({ message: error.message, type: 'api' });
      setLoading({ cloning: false, loadingGraph: false });
    }
  };


  const isLoading = loading.cloning || loading.loadingGraph;


  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-xl font-bold text-white">CodeLearner</h1>
        </div>


        {/* URL Input + Folder Selector */}
        <div className="flex items-center space-x-3 flex-1 max-w-3xl mx-8">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoadRepo()}
            placeholder="https://github.com/owner/repo"
            disabled={isLoading}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* ✅ Folder Selector Dropdown */}
          <select
            value={selectedFolder}
            onChange={(e) => {
              setSelectedFolder(e.target.value);
              if (e.target.value !== 'custom') {
                setCustomFolder(''); // Clear custom input when switching away
              }
            }}
            disabled={isLoading}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
          >
            <option value="">📁 Entire Repo</option>
            <option value="backend">🖥️ Backend</option>
            <option value="frontend">🎨 Frontend</option>
            <option value="src">📂 /src</option>
            <option value="app">📱 /app</option>
            <option value="lib">📚 /lib</option>
            <option value="custom">✏️ Custom...</option>
          </select>

          {/* ✅ NEW: Custom Folder Input (only shows when "Custom" is selected) */}
          {selectedFolder === 'custom' && (
            <input
              type="text"
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
              placeholder="e.g., packages/core"
              disabled={isLoading}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
            />
          )}

          <button
            onClick={handleLoadRepo}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading.cloning && 'Cloning...'}
            {loading.loadingGraph && 'Loading Graph...'}
            {!isLoading && 'Load'}
          </button>
        </div>


        {/* Stats (if repo loaded) */}
        <div className="text-gray-400 text-sm">
          {useAppStore.getState().repository && (
            <span>
              {useAppStore.getState().repository?.owner}/
              {useAppStore.getState().repository?.name}
              {/* ✅ Show analyzed folder */}
              {(selectedFolder && selectedFolder !== 'custom') && (
                <span className="text-blue-400 ml-2">
                  (/{selectedFolder})
                </span>
              )}
              {selectedFolder === 'custom' && customFolder && (
                <span className="text-blue-400 ml-2">
                  (/{customFolder})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};


export default Header;
