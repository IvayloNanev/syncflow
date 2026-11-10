'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export default function WorkNavigation(){const path=usePathname();return <nav aria-label='Main navigation' className='work-navigation'>{[['/work','Today'],['/work/cases','Cases'],['/work/inbox','Inbox']].map(([href,label])=><Link key={href} href={href} aria-current={(href==='/work'?path===href:path.startsWith(href))?'page':undefined}>{label}</Link>)}</nav>;}
