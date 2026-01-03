import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL as string; // e.g. "http://localhost:5002"

interface SignupProps {
  setToken: (token: string | null) => void;
}

const Signup: React.FC<SignupProps> = ({ setToken }) => {
  const navigate = useNavigate();

  const [step, setStep] = useState<'form' | 'otp'>('form');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For debug/dev you can store devOtp if you want to show it
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up.');
      }

      // Move to OTP step, keep email fixed
      setStep('otp');

      // Optional: keep devOtp from backend for quick manual testing
      if (data.devOtp) {
        setDevOtp(data.devOtp);
        console.log('[DEV] OTP:', data.devOtp);
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify email.');
      }

      // Save token + user in localStorage for later API calls
      localStorage.setItem('codelearnerToken', data.token);
      localStorage.setItem('codelearnerUser', JSON.stringify(data.user));

      // IMPORTANT: update App state so /app is unlocked
      setToken(data.token);

      // Redirect to main app (GraphPanel)
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          {step === 'form' ? 'Create your CodeLearner account' : 'Verify your email'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
          {step === 'form'
            ? 'Sign up with your email and password. We will send an OTP to verify your email.'
            : (
              <>
                We sent a 6-digit OTP to <span className="font-semibold">{email}</span>.{' '}
                <span className="text-xs block mt-1">
                  Email usually arrives in 1–3 seconds. If you don’t see it, please check your spam or
                  junk folder.
                </span>
              </>
            )}
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-4 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {step === 'form' ? (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Info box about email/spam */}
            <div className="mb-2 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              📧 OTP sent to <span className="font-semibold">{email}</span>. If it’s not in your inbox,
              please check your spam or junk folder.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
              />
            </div>

            {devOtp && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Dev OTP (for local testing): <span className="font-mono">{devOtp}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;


// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// const API_BASE = import.meta.env.VITE_API_URL as string; // "http://localhost:5002"

// interface SignupProps {
//   setToken: (token: string | null) => void;
// }

// const Signup: React.FC<SignupProps> = ({ setToken }) => {
//   const navigate = useNavigate();

//   const [step, setStep] = useState<'form' | 'otp'>('form');

//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');

//   const [otp, setOtp] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // For debug/dev you can store devOtp if you want to show it
//   const [devOtp, setDevOtp] = useState<string | null>(null);

//   const handleSignup = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError(null);
//     setLoading(true);

//     try {
//       const response = await fetch(`${API_BASE}/api/auth/signup`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ name, email, password }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.error || 'Failed to sign up.');
//       }

//       // Move to OTP step, keep email fixed
//       setStep('otp');

//       // Optional: keep devOtp from backend for quick manual testing
//       if (data.devOtp) {
//         setDevOtp(data.devOtp);
//         console.log('[DEV] OTP:', data.devOtp);
//       }
//     } catch (err: any) {
//       setError(err.message || 'Signup failed.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleVerifyOtp = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError(null);
//     setLoading(true);

//     try {
//       const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ email, otp }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.error || 'Failed to verify email.');
//       }

//       // Save token + user in localStorage for later API calls
//       localStorage.setItem('codelearnerToken', data.token);
//       localStorage.setItem('codelearnerUser', JSON.stringify(data.user));

//       // IMPORTANT: update App state so /app is unlocked
//       setToken(data.token);

//       // Redirect to main app (GraphPanel)
//       navigate('/app', { replace: true });
//     } catch (err: any) {
//       setError(err.message || 'OTP verification failed.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
//       <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md p-8">
//         <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
//           {step === 'form' ? 'Create your CodeLearner account' : 'Verify your email'}
//         </h1>
//         <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
//           {step === 'form'
//             ? 'Sign up with your email and password. We will send an OTP to verify your email.'
//             : `We sent a 6-digit OTP to ${email}. Enter it below to complete signup.`}
//         </p>

//         {error && (
//           <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-4 py-2 text-sm text-red-700 dark:text-red-300">
//             {error}
//           </div>
//         )}

//         {step === 'form' ? (
//           <form onSubmit={handleSignup} className="space-y-4">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Name
//               </label>
//               <input
//                 type="text"
//                 value={name}
//                 onChange={e => setName(e.target.value)}
//                 className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 placeholder="Your name"
//               />
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Email
//               </label>
//               <input
//                 type="email"
//                 value={email}
//                 onChange={e => setEmail(e.target.value)}
//                 className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 placeholder="you@example.com"
//                 required
//               />
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Password
//               </label>
//               <input
//                 type="password"
//                 value={password}
//                 onChange={e => setPassword(e.target.value)}
//                 className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 placeholder="Minimum 6 characters"
//                 required
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
//             >
//               {loading ? 'Creating account...' : 'Sign Up'}
//             </button>
//           </form>
//         ) : (
//           <form onSubmit={handleVerifyOtp} className="space-y-4">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 Email
//               </label>
//               <input
//                 type="email"
//                 value={email}
//                 disabled
//                 className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
//               />
//             </div>

//             <div>
//               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
//                 OTP
//               </label>
//               <input
//                 type="text"
//                 value={otp}
//                 onChange={e => setOtp(e.target.value)}
//                 className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
//                 placeholder="Enter 6-digit code"
//                 maxLength={6}
//                 required
//               />
//             </div>

//             {devOtp && (
//               <p className="text-xs text-gray-500 dark:text-gray-400">
//                 Dev OTP (for local testing): <span className="font-mono">{devOtp}</span>
//               </p>
//             )}

//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full mt-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
//             >
//               {loading ? 'Verifying...' : 'Verify Email'}
//             </button>
//           </form>
//         )}

//         <div className="mt-4 text-center">
//           <p className="text-sm text-gray-600 dark:text-gray-400">
//             Already have an account?{' '}
//             <button
//               type="button"
//               onClick={() => navigate('/login')}
//               className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
//             >
//               Log in
//             </button>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Signup;
