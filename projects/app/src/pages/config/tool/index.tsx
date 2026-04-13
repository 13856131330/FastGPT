import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { serviceSideProps } from '@/web/common/i18n/utils';

const ToolProviderHidden = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/team');
  }, [router]);
  return null;
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['app', 'file']))
    }
  };
}

export default ToolProviderHidden;
