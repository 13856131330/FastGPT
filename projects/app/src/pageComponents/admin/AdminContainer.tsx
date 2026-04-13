import React, { useCallback, useMemo, useRef } from 'react';
import { Box, Flex, useTheme } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import PageContainer from '@/components/PageContainer';
import SideTabs from '@/components/SideTabs';
import { useUserStore } from '@/web/support/user/useUserStore';

export enum AdminTabEnum {
  employee = 'employee',
  team = 'team',
  model = 'model'
}

const AdminContainer = ({
  children,
  isLoading
}: {
  children: React.ReactNode;
  isLoading?: boolean;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { userInfo } = useUserStore();

  const currentTab = useMemo(() => {
    return router.pathname.split('/').pop() as AdminTabEnum;
  }, [router.pathname]);

  const tabList = useRef([
    {
      icon: 'support/user/usersLight',
      label: '员工管理',
      value: AdminTabEnum.employee
    },
    {
      icon: 'support/user/usersLight',
      label: t('account:team'),
      value: AdminTabEnum.team
    },
    {
      icon: 'common/model',
      label: t('account:model_provider'),
      value: AdminTabEnum.model
    }
  ]);

  const setCurrentTab = useCallback(
    (tab: string) => {
      router.replace('/admin/' + tab);
    },
    [router]
  );

  // root only
  if (userInfo?.username !== 'root') {
    return (
      <PageContainer isLoading={false}>
        <Flex h={'100%'} alignItems={'center'} justifyContent={'center'} color={'myGray.600'}>
          {t('common:auth_error')}
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer isLoading={isLoading}>
      <Flex h={'100%'} pt={[4, 0]}>
        <Flex
          flexDirection={'column'}
          p={4}
          h={'100%'}
          flex={'0 0 200px'}
          borderRight={theme.borders.base}
        >
          <SideTabs<AdminTabEnum>
            flex={1}
            mx={'auto'}
            mt={2}
            w={'100%'}
            list={tabList.current}
            value={currentTab}
            onChange={setCurrentTab}
          />
        </Flex>

        <Box flex={'1 0 0'} h={'100%'} pb={[4, 0]} overflow={'auto'}>
          {children}
        </Box>
      </Flex>
    </PageContainer>
  );
};

export default AdminContainer;
