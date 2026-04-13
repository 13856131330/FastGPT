import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { Types } from '@fastgpt/service/common/mongo';

type ReqBody = {
  name: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId, tmbId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  const { name } = req.body;

  await MongoTeamMember.updateOne(
    {
      _id: new Types.ObjectId(String(tmbId)),
      teamId: new Types.ObjectId(String(teamId))
    },
    {
      $set: {
        name: name?.trim() || 'Member',
        updateTime: new Date()
      }
    }
  );
}

export default NextAPI(handler);
