import { POST } from '@/web/common/api/request';

export const postAdminCreateUser = (data: {
  username: string;
  password: string;
  memberName?: string;
}) => POST<{ userId: string; tmbId: string }>('/support/user/admin/createUser', data);

export const putAdminUpdateUserStatus = (data: { userId: string; status: string }) =>
  POST<string>('/support/user/admin/user/updateStatus', data);

export const delAdminDeleteUser = (data: { userId: string }) =>
  POST<string>('/support/user/admin/user/delete', data);
