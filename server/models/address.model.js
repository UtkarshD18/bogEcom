import mongoose from "mongoose";
const addressSchema = mongoose.Schema({
    address_line1:{
        type: String,
        default: ''
    },
    city:{
        type: String,
        default: ''
    },
    state:{
        type: String,
        default: ''
    },
    pincode:{
        type: String,
    },
    country:{
        type: String,
        default: ''
    },
    mobile:{
        type: Number,
        default: null
    },
    selected:{
type: Boolean,
default: true
    },
    landmark:{
type: String,
    },
    addressType:{
    type: String,
    enum: ['Home', 'Work', 'Other'],
    },
    userId:{
        type:String,
        default:''
    }

},{timestamps: true}

)
const AddressModel = mongoose.model("Address", addressSchema);
export default AddressModel;