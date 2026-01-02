import authService from './src/services/authService';

async function run() {
  const pwd = 'test1234';
  const hash = await authService.hashPassword(pwd);
  console.log('Hash:', hash);

  console.log('Correct:', await authService.comparePassword('test1234', hash));
  console.log('Wrong:', await authService.comparePassword('wrong', hash));
}

run().catch(console.error);
