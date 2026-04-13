'use client';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const ModelProvider = () => {
  const router = useRouter();

  // 已迁移到管理员页面
  useEffect(() => {
    router.replace('/admin/model');
  }, [router]);

  return null;
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['account', 'account_model', 'user']))
    }
  };
}

export default ModelProvider;
