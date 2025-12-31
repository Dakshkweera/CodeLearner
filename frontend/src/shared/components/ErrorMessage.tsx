import { useAppStore } from '../store/appStore';

const ErrorMessage = () => {
  const { error, setError } = useAppStore();

  if (!error) return null;

  return (
    <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <span className="text-xl">⚠️</span>
        <span>{error.message}</span>
      </div>
      <button
        onClick={() => setError(null)}
        className="text-red-400 hover:text-red-300 font-bold"
      >
        ✕
      </button>
    </div>
  );
};

export default ErrorMessage;
