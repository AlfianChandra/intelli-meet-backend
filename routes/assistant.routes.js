import express from 'express'
import {
	createProject,
	getProjectData,
	getProjects,
	updateProject,
	deleteProject,
} from '../controllers/assistant.controller.js'
const router = express.Router()
router.post('/project/create', createProject)
router.post('/project/get', getProjectData)
router.get('/project/getall', getProjects)
router.post('/project/update', updateProject)
router.post('/project/delete', deleteProject)
export default router
