import mongoose from 'mongoose'
const projectSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
	},
	id_user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	memory: {
		type: Number,
		default: 6,
	},
	temperature: {
		type: Number,
		default: 0.7,
	},
	custom_instructions: {
		type: String,
		default: '',
	},
	conversations: {
		type: Array,
		default: [],
	},
	last_topic: {
		type: String,
		default: '',
	},
})

export const Project = mongoose.model('Project', projectSchema)
