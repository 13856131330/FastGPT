'use client';

import React from 'react';
import { serviceSideProps } from '@/web/common/i18n/utils';
import AdminContainer from '@/pageComponents/admin/AdminContainer';
import { Box } from '@chakra-ui/react';
import dynamic from 'next/dynamic';

const MemberTable = dynamic(() => import('@/pageComponents/account/team/MemberTable'));

export default function EmployeeManage() {
  return (
    <AdminContainer>
      <Box p={6} h={'100%'}>
        <MemberTable Tabs={<Box fontWeight={500}>员工管理</Box>} />
      </Box>
    </AdminContainer>
  );
}

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['account', 'account_team', 'user']))
    }
  };
}
