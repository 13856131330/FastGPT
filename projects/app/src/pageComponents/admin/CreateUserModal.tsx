import React, { useMemo, useState } from 'react';
import {
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  ModalBody,
  ModalFooter
} from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { useTranslation } from 'next-i18next';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { postAdminCreateUser } from '@/web/support/user/admin/api';

function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [memberName, setMemberName] = useState('');

  const canSubmit = useMemo(() => username.trim() && password.trim(), [password, username]);

  const { runAsync: onCreate, loading } = useRequest(
    () =>
      postAdminCreateUser({
        username: username.trim(),
        password: password.trim(),
        memberName: memberName.trim() || undefined
      }),
    {
      manual: true,
      successToast: t('common:Success'),
      onSuccess: () => {
        onSuccess();
        onClose();
      }
    }
  );

  return (
    <MyModal isOpen title={'新建用户'} iconSrc="support/user/usersLight" onClose={onClose}>
      <ModalBody>
        <Flex flexDirection="column" gap={4}>
          <FormControl isRequired>
            <FormLabel>用户名</FormLabel>
            <Input
              placeholder="用于登录的用户名（唯一）"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>初始密码</FormLabel>
            <Input
              placeholder="设置初始密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel>成员昵称（可选）</FormLabel>
            <Input
              placeholder="不填默认使用用户名"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
            />
          </FormControl>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button variant="whiteBase" mr={3} onClick={onClose}>
          {t('common:Cancel')}
        </Button>
        <Button
          variant="primary"
          isDisabled={!canSubmit}
          isLoading={loading}
          onClick={() => onCreate()}
        >
          {t('common:Confirm')}
        </Button>
      </ModalFooter>
    </MyModal>
  );
}

export default CreateUserModal;
