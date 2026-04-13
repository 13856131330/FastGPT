import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { Types } from '@fastgpt/service/common/mongo';

type ReqBody = {
  tmbId: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { tmbId } = req.body;

  await MongoTeamMember.updateOne(
    {
      _id: new Types.ObjectId(String(tmbId)),
      teamId: new Types.ObjectId(String(teamId))
    },
    {
      $set: {
        status: TeamMemberStatusEnum.active,
        updateTime: new Date()
      }
    }
  );
}

export default NextAPI(handler);
