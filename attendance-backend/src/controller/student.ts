import path from 'path'
import util from 'util'
import axios from 'axios'
import fse from 'fs-extra'

import {
  getStudentByOpenid,
  registerByOpenid,
  updateStudent,
  getStudentById
} from '../services/student'
import { appId, appSecret, loginUrl } from '../conf/wx'
import { errorInfo } from '../constants/errorInfo'
import { IFolder } from '../typings/interfaces/student'
import { JWT } from '../utils/JWT'
import { ErrorModel, SuccessModel } from '../utils/resModel'
import { put } from '../utils/oss'
import { getFileContentAsBase64 } from '../utils/base64'
import { faceDetection } from '../utils/face'

/**
 * 通过 code 换取 openid, 并生成 token
 */
export const codeToToken = async (code: string) => {
  const url = util.format(loginUrl, appId, appSecret, code)
  let openID = ''
  const result = await axios.get(url)
  if (result.status !== 200) {
    // throw new Error('openid获取失败')
    return new ErrorModel(errorInfo.getOpenIdFailInfo)
  }
  const errcode = result.data.errcode

  if (errcode) {
    if (errcode === 40029) {
      //给一个默认兜底的openid
      openID = 'OPENID' + code
      console.log('openid获取失败，使用默认openid:', openID)
    } else {
      return new ErrorModel(errorInfo.getOpenIdFailInfo)
    }
  } else {
    openID = result.data.openid
  }

  let student = await getStudentByOpenid(openID)
  console.log('student:', student)
  if (!student) {
    // 如果不存在，则注册
    student = await registerByOpenid(openID)
  }

  const token = JWT.generate(
    {
      studentId: student.id,
      studentName: student.userName
    },
    '24h'
  )
  return new SuccessModel({ token })
}

/**
 * 修改学号
 */
export const changeStudentNumber = async (
  id: number,
  studentNumber: string
) => {
  const student = await getStudentById(id)
  if (student?.studentNumberModified) {
    // 学号修改过，不允许再次修改
    return new ErrorModel(errorInfo.changeInfoFailInfo)
  }
  const result = await updateStudent(id, { studentNumber })
  if (result) {
    return new SuccessModel()
  }
  return new ErrorModel(errorInfo.changeInfoFailInfo)
}

/**
 * 查询学生信息
 */
export const getInfo = async (id: number) => {
  const result = await getStudentById(id)
  if (result) {
    return new SuccessModel({
      userName: result.userName,
      studentNumber: result.studentNumber ?? '',
      avatar: result.avatar ?? '',
      userNameModified: !!result.userNameModified,
      studentNumberModified: !!result.studentNumberModified,
      faceImg: result.faceImg ?? ''
    })
  }
  return new ErrorModel(errorInfo.getUserInfoFailInfo)
}

export const changeUserName = async (id: number, userName: string) => {
  const student = await getStudentById(id)
  if (student?.userNameModified) {
    // 姓名修改过，不允许再次修改
    return new ErrorModel(errorInfo.changeInfoFailInfo)
  }
  const result = await updateStudent(id, { userName })
  if (result) {
    return new SuccessModel()
  }
  return new ErrorModel(errorInfo.changeInfoFailInfo)
}
/**
 * 上传头像、人脸
 */
export const uploadImage = async (
  id: number,
  folder: IFolder,
  filename: string
) => {
  const filePath = path.join(__dirname, `../../upload/${folder}`, filename)

  if (folder === 'faceImg') {
    // 人脸检测
    const isOneFace = await faceDetection(getFileContentAsBase64(filePath))
    if (!isOneFace) {
      // 未通过人脸检测
      return new ErrorModel(errorInfo.faceDetectionFailInfo)
    }
  }
  // 上传 OSS
  // const url = await put(`/${folder}/${filename}`)
  // 从本地 upload 文件夹中删除该图片a
  // await fse.remove(filePath)
  const targetUrl = `http://127.0.0.1:3001/${folder}/${filename}`
  // 先用本地文件夹测试
  const result = await updateStudent(
    id,
    folder === 'avatar' ? { avatar: targetUrl } : { faceImg: targetUrl }
  )
  if (result) {
    return new SuccessModel({
      url: targetUrl
    })
  }
  // if (url) {
  // }
  return new ErrorModel(errorInfo.changeInfoFailInfo)
}
