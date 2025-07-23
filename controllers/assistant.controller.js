import { Project } from '../models/project.model.js'

export const updateProject = async (req, res) => {
	try {
		const { id_project, ...fieldsToUpdate } = req.body
		const updatedProject = await Project.findByIdAndUpdate(id_project, fieldsToUpdate, {
			new: true,
		})
		if (!updatedProject) {
			return res.status(404).json({ status: 404, message: 'Project not found' })
		}

		return res.status(200).json({ status: 200, data: updatedProject })
	} catch (error) {
		console.error('Error updating project:', error)
		return res.status(500).json({ status: 500, message: 'Internal server error' })
	}
}

export const getProjectData = async (req, res) => {
	try {
		const { id_project } = req.body
		const project = await Project.findById(id_project)
		if (!project) {
			return res.status(404).json({ status: 404, message: 'Project not found' })
		}
		return res.status(200).json({ status: 200, data: project })
	} catch (error) {
		console.error('Error fetching project data:', error)
		return res.status(500).json({ status: 500, message: 'Internal server error' })
	}
}

export const getProjects = async (req, res) => {
	try {
		const idUser = req.user.id
		const projects = await Project.find({ id_user: idUser })
		return res.status(200).json({ status: 200, data: projects })
	} catch (error) {
		console.error('Error fetching projects:', error)
		return res.status(500).json({ status: 500, message: 'Internal server error' })
	}
}
export const createProject = async (req, res) => {
	try {
		const { name, custom_instruction, temperature, memory } = req.body
		const userId = req.user.id
		const newProject = new Project({
			name: name,
			id_user: userId,
			custom_instructions: custom_instruction,
			temperature: temperature,
			memory: memory,
		})
		await newProject.save()
		return res.status(200).json({ status: 200, data: newProject })
	} catch (error) {
		console.error('Error creating project:', error)
		return res.status(500).json({ status: 500, message: 'Internal server error' })
	}
}

export const deleteProject = async (req, res) => {
	try {
		const { id_project } = req.body
		const deletedProject = await Project.findByIdAndDelete(id_project)
		if (!deletedProject) {
			return res.status(404).json({ status: 404, message: 'Project not found' })
		}
		return res.status(200).json({ status: 200, message: 'Project deleted successfully' })
	} catch (error) {
		console.error('Error deleting project:', error)
		return res.status(500).json({ status: 500, message: 'Internal server error' })
	}
}
