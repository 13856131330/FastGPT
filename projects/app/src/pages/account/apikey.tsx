'use client';
import React from 'react';
import ApiKeyTable from '@/components/support/apikey/Table';
import { useTranslation } from 'next-i18next';
import { Box } from '@chakra-ui/react';
import AccountContainer from '@/pageComponents/account/AccountContainer';

const ApiKey = () => {
  const { t } = useTranslation();
  return (
    <AccountContainer>
      <Box px={[4, 8]} py={[4, 6]}>
        <ApiKeyTable tips={t('account_apikey:key_tips')}></ApiKeyTable>
      </Box>
    </AccountContainer>
  );
};

export async function getServerSideProps(content: any) {
  return {
    redirect: {
      destination: '/account/info',
      permanent: false
    }
  };
}

export default ApiKey;
