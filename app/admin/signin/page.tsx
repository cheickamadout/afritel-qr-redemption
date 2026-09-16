// Signin page removed - no authentication needed
import { redirect } from 'next/navigation';

export default function SignInPage() {
  redirect('/admin/dashboard');
}
