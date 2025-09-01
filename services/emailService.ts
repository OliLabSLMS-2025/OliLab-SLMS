import { User } from '../types';

/**
 * NOTE: This is a mock email service. In a real application, this would
 * integrate with an actual email provider like SendGrid, Mailgun, etc.
 * For now, it logs messages to the console to simulate email sending.
 */

const logEmail = (to: string, subject: string, body: string) => {
    console.log(`
    --- 📧 SIMULATING EMAIL 📧 ---
    To: ${to}
    Subject: ${subject}
    
    ${body}
    -----------------------------
    `);
};

export const sendLoginNotification = (user: User) => {
    const subject = "Security Alert: Successful Login to Your OliLab Account";
    const body = `
    Hi ${user.fullName},

    This is a confirmation that your OliLab account was just accessed.

    Date & Time: ${new Date().toLocaleString()}

    If this was you, you can safely ignore this email.
    If you do not recognize this activity, please change your password immediately and contact an administrator.

    Thank you,
    The OliLab Team
    `;
    logEmail(user.email, subject, body);
};

export const sendProfileUpdateNotification = (user: User, changedByAdmin: boolean = false) => {
    const subject = "Your OliLab Account Information Was Updated";
    const body = `
    Hi ${user.fullName},

    This email is to confirm that your account details have been successfully updated.
    ${changedByAdmin ? "\n    An administrator made this change on your behalf." : ""}

    If you did not request this change, please contact an administrator immediately.

    Thank you,
    The OliLab Team
    `;
    logEmail(user.email, subject, body);
};


export const sendNewUserAdminNotification = (newUser: User, admins: User[]) => {
    const subject = `New User Registration: ${newUser.fullName}`;
    const body = `
    Hello OliLab Administrators,

    A new user has just signed up for an account.

    **User Details:**
    - Full Name: ${newUser.fullName}
    - Username: ${newUser.username}
    - Email: ${newUser.email}
    - Role: ${newUser.role}
    ${newUser.lrn ? `- LRN: ${newUser.lrn}` : ''}
    ${newUser.gradeLevel ? `- Grade: ${newUser.gradeLevel} - ${newUser.section}` : ''}

    Please review their account if necessary.

    Thank you,
    OliLab System
    `;
    
    admins.forEach(admin => {
        logEmail(admin.email, subject, body);
    });
};