import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { graphService } from '../../features/graph';

const Header = () => {
  const [url, setUrl] = useState('');
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

    try {
      setError(null);
      setLoading({ cloning: true });

      // Clone repository
      console.log('Cloning repository:', url);
      const cloneResult = await graphService.cloneRepository(url);
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
      const graphData = await graphService.getGraph(parsed.owner, parsed.name);
      
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

        {/* URL Input */}
        <div className="flex items-center space-x-3 flex-1 max-w-2xl mx-8">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoadRepo()}
            placeholder="https://github.com/owner/repo"
            disabled={isLoading}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
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
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
