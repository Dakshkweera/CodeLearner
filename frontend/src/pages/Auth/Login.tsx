// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// // Backend root, from .env: VITE_API_URL=http://localhost:5002
// const API_BASE = import.meta.env.VITE_API_URL as string;

// interface LoginProps {
//   setToken: (token: string | null) => void;
// }

// const Login: React.FC<LoginProps> = ({ setToken }) => {
//   const navigate = useNavigate();

//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError(null);
//     setLoading(true);

//     try {
//       const response = await fetch(`${API_BASE}/api/auth/login`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.error || 'Failed to log in.');
//       }

//       // Save token + user
//       localStorage.setItem('codelearnerToken', data.token);
//       localStorage.setItem('codelearnerUser', JSON.stringify(data.user));

//       setToken(data.token);
//       navigate('/', { replace: true });
//     } catch (err: any) {
//       setError(err.message || 'Login failed.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
//       <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md p-8">
//         <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
//           Log in to CodeLearner
//         </h1>
//         <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
//           Enter your email and password to continue.
//         </p>

//         {error && (
//           <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-4 py-2 text-sm text-red-700 dark:text-red-300">
//             {error}
//           </div>
//         )}

//         <form onSubmit={handleLogin} className="space-y-4">
//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               Email
//             </label>
//             <input
//               type="email"
//               value={email}
//               onChange={e => setEmail(e.target.value)}
//               className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
//               placeholder="you@example.com"
//               required
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//               Password
//             </label>
//             <input
//               type="password"
//               value={password}
//               onChange={e => setPassword(e.target.value)}
//               className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
//               placeholder="Your password"
//               required
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
//           >
//             {loading ? 'Logging in...' : 'Log In'}
//           </button>
//         </form>

//         <div className="mt-4 text-center">
//           <p className="text-sm text-gray-600 dark:text-gray-400">
//             Don&apos;t have an account?{' '}
//             <button
//               type="button"
//               onClick={() => navigate('/signup')}
//               className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
//             >
//               Sign up
//             </button>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Login;


import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL as string;

interface LoginProps {
  setToken: (token: string | null) => void;
}

const Login: React.FC<LoginProps> = ({ setToken }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      // Save token + user
      localStorage.setItem('codelearnerToken', data.token);
      localStorage.setItem('codelearnerUser', JSON.stringify(data.user));

      // Update App state so /app becomes accessible
      setToken(data.token);

      // Go straight to main app, not landing page
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-xl shadow-lg w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          Log in to CodeLearner
        </h1>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Enter your email and password to continue.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-900/40 border border-red-700 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-semibold transition-colors"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        {/* Sign up link */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="text-blue-400 font-semibold hover:underline"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
