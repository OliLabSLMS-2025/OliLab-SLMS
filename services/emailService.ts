import { User, UserStatus } from '../types';

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
    const subject = `[ACTION REQUIRED] New User Registration: ${newUser.fullName}`;
    const body = `
    Hello OliLab Administrators,

    A new user has just signed up and is awaiting approval.

    **User Details:**
    - Full Name: ${newUser.fullName}
    - Username: ${newUser.username}
    - Email: ${newUser.email}
    
    Please visit the 'Users' page in the admin dashboard to review and approve their account.

    Thank you,
    OliLab System
    `;
    
    admins.forEach(admin => {
        logEmail(admin.email, subject, body);
    });
};

export const sendAccountStatusNotification = (user: User) => {
    let subject = '';
    let body = '';

    if (user.status === UserStatus.ACTIVE) {
        subject = 'Your OliLab Account has been Approved!';
        body = `
    Hi ${user.fullName},

    Great news! Your account for the OliLab system has been approved by an administrator.
    
    You can now log in using your credentials.

    Welcome aboard!
    The OliLab Team
    `;
    } else if (user.status === UserStatus.DENIED) {
        subject = 'Update on Your OliLab Account Application';
        body = `
    Hi ${user.fullName},

    Thank you for your interest in OliLab. After a review, your account application has been denied.
    
    If you believe this is a mistake, please contact a laboratory administrator.

    Regards,
    The OliLab Team
    `;
    }

    if (subject && body) {
        logEmail(user.email, subject, body);
    }
};