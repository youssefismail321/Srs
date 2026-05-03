import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!session || !profile) {
      router.replace('/(auth)/login');
      return;
    }

    if (!profile.is_active) {
      router.replace('/(auth)/login');
      return;
    }

    switch (profile.role) {
      case 'community_member':
        router.replace('/(community)/');
        break;
      case 'facility_manager':
        router.replace('/(manager)/');
        break;
      case 'worker':
        router.replace('/(worker)/');
        break;
      case 'admin':
        router.replace('/(admin)/');
        break;
    }
  }, [loading, session, profile]);

  return <LoadingScreen message="Starting CampusCare..." />;
}
