import { create } from 'zustand';
import type {
  Repository,
  FileGraph,
  SelectedFile,
  LoadingState,
  ErrorState,
} from '../types';

interface AppStore {
  // State
  repository: Repository | null;
  graphData: FileGraph | null;
  selectedFile: SelectedFile | null;
  loading: LoadingState;
  error: ErrorState | null;

  // Actions
  setRepository: (repo: Repository | null) => void;
  setGraphData: (graph: FileGraph | null) => void;
  setSelectedFile: (file: SelectedFile | null) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setError: (error: ErrorState | null) => void;
  reset: () => void;
}

const initialState = {
  repository: null,
  graphData: null,
  selectedFile: null,
  loading: {
    cloning: false,
    loadingGraph: false,
    loadingFile: false,
  },
  error: null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setRepository: (repo) => set({ repository: repo }),
  setGraphData: (graph) => set({ graphData: graph }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setLoading: (loading) =>
    set((state) => ({ loading: { ...state.loading, ...loading } })),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
