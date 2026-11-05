'use client';
import {useFormStatus} from 'react-dom';
// Disabled while pending so a double click can't send two confirmation emails.
export default function AuthSubmit({label,pendingLabel}:{label:string;pendingLabel:string}){
 const {pending}=useFormStatus();
 return <button type="submit" className="primary-button" disabled={pending}>{pending?pendingLabel:label}</button>;
}
