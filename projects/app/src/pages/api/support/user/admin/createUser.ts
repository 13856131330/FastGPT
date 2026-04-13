import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authSystemAdmin } from '@fastgpt/service/support/permission/user/auth';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { Types } from '@fastgpt/service/common/mongo';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { hashStr } from '@fastgpt/global/common/string/tools';

type ReqBody = {
  username: string;
  password: string;
  memberName?: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId } = await authSystemAdmin({ req });

  const username = (req.body.username || '').trim();
  const password = (req.body.password || '').trim();
  const memberName = (req.body.memberName || '').trim();

  if (!username || !password) {
    return Promise.reject(CommonErrEnum.missingParams);
  }
  if (username.toLowerCase() === 'root') {
    return Promise.reject(ERROR_ENUM.unAuthorization);
  }

  const exist = await MongoUser.findOne({ username }).lean();
  if (exist) {
    return Promise.reject(UserErrEnum.userExist);
  }

  /**
   * 密码存储规则（与前端一致）：
   * - 前端登录会先 sha256(明文) 再提交到后端
   * - 因此数据库里应存 sha256(明文)（单次 hash）
   *
   * 注意：MongoUser schema 里 password 有 setter，会再次 hash，导致“双重 hash”进而登录失败。
   * 这里用原生 collection 写入来绕过 setter，确保只 hash 一次。
   */
  const { insertedId } = await MongoUser.collection.insertOne({
    username,
    password: hashStr(password),
    passwordUpdateTime: new Date(),
    status: UserStatusEnum.active,
    createTime: new Date()
  } as any);

  const tmb = await MongoTeamMember.create({
    teamId: new Types.ObjectId(String(teamId)),
    userId: insertedId,
    name: memberName || username,
    status: TeamMemberStatusEnum.active,
    role: 'member',
    createTime: new Date()
  });

  return {
    userId: String(insertedId),
    tmbId: String(tmb._id)
  };
}

export default NextAPI(handler);
