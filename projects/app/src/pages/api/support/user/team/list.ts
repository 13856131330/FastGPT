import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import type { TeamMemberSchema, TeamTmbItemType } from '@fastgpt/global/support/user/team/type';

type ReqQuery = {
  status: `${TeamMemberSchema['status']}`;
};

async function handler(req: ApiRequestProps<{}, ReqQuery>, res: ApiResponseType<any>) {
  const { tmb } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  const { status } = req.query;

  const list: TeamTmbItemType[] = status ? (tmb.status === status ? [tmb] : []) : [tmb];
  return list;
}

export default NextAPI(handler);
