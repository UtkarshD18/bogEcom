"use client"
import { useState } from 'react';

const OtpBox=({length,onChange})=>{
    const [otp,setOtp]=useState(new Array(length).fill(""));
    const handleChange=(e,index)=>{
const value=e.value;

if(isNaN(value)) return false;

 const newOtp=[...otp];
        newOtp[index]=value;
        setOtp(newOtp);

        onChange(newOtp.join(""));

        if(value && index<length-1){
            document.getElementById(`otp-input-${index+1}`).focus();
        }
    }

    const handleKeyDown=(e,index)=>{
if(e.key==="Backspace" && !otp[index] && index>0){
    document.getElementById(`otp-input-${index-1}`).focus();
}
       
    }
    return (
        <div className='flex items-center justify-center gap-3'>{
        otp?.map((data ,index)=>{
          return (
            <input 
               key={index}
               id={`otp-input-${index}`}
               type={"text"}
               maxLength={1}
               value={otp[index]}
               onChange={(e)=>handleChange(e.target,index)}
               onKeyDown={(e)=>handleKeyDown(e,index)}
               className='w-[45px] h-[45px] sm:w-[55px] sm:h-[55px] text-center text-[17px] rounded-md border border-[rgba(0,0,0,0.2)]'
            />
          )
        })
        }
        </div>
    )
}
export default OtpBox;