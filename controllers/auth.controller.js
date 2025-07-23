import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../models/user.model.js';
import { Login } from '../models/login.model.js';
import moment from 'moment-timezone';
import { Log } from '../models/logs.model.js';
import { PhoneVerify } from '../models/phoneverifys.model.js';
import dotenv from 'dotenv';
import {validateDateOfBirth, validatePassword, validateName, validateEmail, validatePhoneNumber} from '../utils/inputValidator.js';
dotenv.config();
const { JWT_SECRET, JWT_EXPIRATION } = process.env;

export const clientLogout = async(req, res) => {
  try {
    const token = req.body.token;
    await Login.findOneAndDelete({ token: token });
    if (!token) {
      return res.status(401).json({ status: 401, message: 'Unauthorized - token not found' });
    }
    return res.status(200).json({ status: 200, message: 'Logout successful' });
  } catch (error) { 
    console.error('Error during logout:', error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
}

export const clientLoginWebmaster = async (req, res) => {
    try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email, role: 'webmaster' });
    if (!user) { 
      return res.status(401).json({ status: 401, message: 'Wrong E-mail or password' });
    }

    //verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ status: 401, message: 'Wrong E-mail or password' });
    }

    //Check login
    const login = await Login.findOne({ userId: user._id });
    if(login) {
      return res.status(401).json({ status: 401, message: 'Already logged in' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id, role:'webmaster' }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    //write log
    const log = new Log({
      userId: user._id,
      action: `User logged in => ${user.name + ": " + user.email}`,
      role: 'webmaster',
      timestamp: moment.tz("Asia/Jakarta").toDate()
    });

    // Save login information
    const newLogin = new Login({
      userId: user._id,
      token: token,
      role: 'webmaster',
      ipAddress: req.ip,
      method: "email_login",
      userAgent: req.headers['user-agent'],
      email: user.email,
      timestamp: moment.tz("Asia/Jakarta").toDate()
    });

    // Save login and log to database
    await newLogin.save();
    await log.save();

    // Return token and user data
    return res.status(200).json({
      status: 200,
      message: 'Login successful',
      token: token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error) { 
    console.error('Error during login:', error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
}

export const clientLogin = async (req, res) => { 
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email, role: 'user' });
    if (!user) { 
      return res.status(401).json({ status: 401, message: 'Wrong E-mail or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ status: 401, message: 'Wrong E-mail or password' });
    }

    const token = jwt.sign({ id: user._id, role:'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    const log = new Log({
      userId: user._id,
      action: `User logged in => ${user.name + ": " + user.email}`,
      role: 'user',
      timestamp: moment.tz("Asia/Jakarta").toDate()
    });

    // Save login and log to database
    await log.save();

    // Return token and user data
    return res.status(200).json({
      status: 200,
      message: 'Login successful',
      token: token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error) { 
    console.error('Error during login:', error);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
}

export const clientRegister = async (req, res) => {
  try {
    // Get user data from request body
    const name = req.body.name;
    const password = req.body.password;
    const email = req.body.email;
    let google_signin = false;
    // Validate username and password
    if (!validateName(name)) {
      return res.status(400).json({status:400, message: 'Invalid name' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({status:400, message: 'Invalid password' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({status:400, message: 'Invalid E-Mail' });
    }


    if(req.body.google_signin) {
      google_signin = req.body.google_signin;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: name,
      password: hashedPassword,
      email: email,
      role: 'user',
      google_signin: google_signin,
    });

    // Check if user already exists
    const existingUser = await User.find({ $or: [{ email: email }] });
    if (existingUser.length > 0) {
      return res.status(400).json({ status:400,message: 'E-mail cannot be used!' });
    }
    //write log
    const log = new Log({
      userId: newUser._id,
      action: `User registered => ${newUser.name+": "+newUser.email}`,
      timestamp: new Date()
    });
    await log.save();
    // Save new user to database
    await newUser.save();

    // Save phone verification data
    const phoneVerify = new PhoneVerify({
      userId: newUser._id,
      verified: false,
      code: Math.floor(100000 + Math.random() * 900000), // Generate a random 6-digit code
      timestamp: moment.tz("Asia/Jakarta").toDate(),
    });
    await phoneVerify.save();
    return res.status(200).json({ message: 'Sign-up success!' });
  } catch (error) { 
    console.error('Error during registration:', error);
    return res.status(500).json({ status:500, message: 'Something went wrong' });
  }
}