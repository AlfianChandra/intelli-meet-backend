import { User } from "../models/user.model.js"
import path from 'path'
import bcrypt from 'bcrypt';
import sharp from 'sharp'
import fs from 'fs'
import { PhoneVerify } from "../models/phoneverifys.model.js"

export const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id
    const { oldPass, newPass } = req.body
    
    // Validate input data
    if (!oldPass || !newPass) {
      return res.status(400).json({ status: 400, message: 'Please fill required fields' })
    }

    if (newPass.length < 8) {
      return res.status(400).json({ status: 400, message: 'New password at least 8 characters' })
    }

    if(oldPass === newPass) {
      return res.status(400).json({ status: 400, message: 'New password cannot be the same as the old one' })
    }

    // Check if user exists
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ status: 404, message: 'Something went wrong' })
    }

    // Check if old password is correct
    const isMatch = await bcrypt.compare(oldPass, user.password)
    if (!isMatch) {
      return res.status(400).json({ status: 400, message: 'Old password is incorrect' })
    }

    // Hash new password
    const hashedNewPass = await bcrypt.hash(newPass, 10)

    // Update password
    user.password = hashedNewPass
    await user.save()
    return res.status(200).json({ status: 200, message: 'Password updated!' })
  } catch (error) {
    console.error('Error updating password:', error)
    return res.status(500).json({ status: 500, message: 'Something went wrong' })
  }
}

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id
    const { name, email } = req.body

    // Validate input data
    if (!name) {
      return res.status(400).json({ status: 400, message: 'Name is required' })
    }

    // Check if user exists
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ status: 404, message: 'Something went wrong' })
    }

    user.name = name

    await user.save()
    return res.status(200).json({ status: 200, message: 'Profile updated!' })
  } catch (error) {
    console.error('Error updating profile:', error)
    return res.status(500).json({ status: 500, message: 'Something went wrong: '+error.message })
  }
}

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 400, message: 'No file uploaded' })
    }

    const userId = req.user.id
    //Check user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ status: 404, message: 'User not found' })
    }

    //Check existing avatar
    if (user.avatar) { 
      const existingAvatarPath = path.resolve('usercontent/avatars'+user.avatar)
      if (fs.existsSync(existingAvatarPath)) { 
        fs.unlinkSync(existingAvatarPath)
      }
    }

    const uploadsDir = path.resolve('usercontent/avatars')
    if (!fs.existsSync(uploadsDir)) { 
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const filename = `avatar_${timestamp}.webp`
    const filePath = path.join(uploadsDir, filename)
    await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 100 })
      .toFile(filePath)
    const fileUrl = `/${filename}`
    user.avatar = fileUrl
    await user.save()
    return res.status(200).json({ status: 200, message: 'ok', fileUrl: fileUrl })
  } catch (error) { 
    console.error('Error uploading avatar:', error)
    return res.status(500).json({ status: 500, message: 'Something went wrong' })
  }
}

export const getProfile = async (req, res) => {
  try {
    const userid = req.user.id
    console.log('userid', userid)
    const getUser = await User.findById(userid).select('-password')
    if (!getUser) {
      return res.status(404).json({ status: 404, message: 'User not found' })
    }
    return res.status(200).json({ status: 200, message: 'ok', profile: getUser })
  }catch (error) {
    console.error('Error fetching user profile:', error)
    return res.status(500).json({ status: 500, message: 'Something went wrong' })
  }
}
