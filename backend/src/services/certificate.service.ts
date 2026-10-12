import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Certificate, CertificateRevocation, CMSPage, Course, Enrollment, StudentProgress, User } from '../models';
import { Conflict, Forbidden, NotFound } from '../lib/errors';
import { certificateId as newCertificateId } from '../lib/ids';
import { storage } from './storage';

export interface CertificateBranding {
  institutionName: string;
  logoUrl?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  signatureUrl?: string;
  sealUrl?: string;
  verifyBaseUrl: string;
}

export async function getBranding(): Promise<CertificateBranding> {
  const page = await CMSPage.findOne({ key: 'certificate' }).lean();
  const content = (page?.publishedContent || page?.draftContent || {}) as Record<string, string>;
  return {
    institutionName: content.institutionName || process.env.CERT_INSTITUTION_NAME || 'IshConnect Academy',
    logoUrl: content.logoUrl,
    signatoryName: content.signatoryName,
    signatoryTitle: content.signatoryTitle,
    signatureUrl: content.signatureUrl,
    sealUrl: content.sealUrl,
    verifyBaseUrl: content.verifyBaseUrl || process.env.CERTIFICATE_VERIFY_BASE_URL || 'http://localhost:5173/verify',
  };
}

export async function issueCertificate(enrollmentId: string, issuedBy: string) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) throw NotFound('Enrollment not found');
  const progress = await StudentProgress.findOne({ enrollment: enrollmentId });
  if (!progress) throw Forbidden('No progress record for this enrollment');
  if (!progress.certificateEligible) {
    throw Forbidden('Course completion requirements are not yet satisfied');
  }

  const already = await Certificate.findOne({ enrollment: enrollmentId, status: { $in: ['issued', 'reissued'] } });
  if (already) throw Conflict('A certificate has already been issued for this completion record');

  const course = await Course.findById(enrollment.course).lean();
  if (!course) throw NotFound('Course not found');

  const branding = await getBranding();
  const student = await User.findById(enrollment.student).lean();
  const certId = newCertificateId();
  const verifyUrl = `${branding.verifyBaseUrl.replace(/\/$/, '')}/${certId}`;

  const cert = await Certificate.create({
    certificateId: certId,
    student: enrollment.student,
    studentName: student?.name || 'Student',
    enrollment: enrollment._id,
    course: enrollment.course,
    courseVersion: enrollment.completedVersion || course.activeVersion,
    courseTitle: course.title,
    courseLevel: course.level,
    school: enrollment.school,
    institutionName: branding.institutionName,
    logoUrl: branding.logoUrl,
    signatoryName: branding.signatoryName,
    signatoryTitle: branding.signatoryTitle,
    signatureUrl: branding.signatureUrl,
    sealUrl: branding.sealUrl,
    completionDate: enrollment.completedAt || new Date(),
    issuedAt: new Date(),
    achievementGrade: gradeFor(progress.completionPercent),
    status: 'issued',
    verifyUrl,
    completionSnapshot: {
      completionPercent: progress.completionPercent,
      averageAssessmentPercent: 0,
      projectTasksCompleted: progress.finalProjectTasksCompleted,
    },
    issuedBy,
  });

  const pdf = await generateCertificatePdf({
    studentName: cert.studentName,
    courseTitle: cert.courseTitle,
    courseLevel: cert.courseLevel,
    institutionName: cert.institutionName,
    completionDate: cert.completionDate,
    certificateId: cert.certificateId,
    grade: cert.achievementGrade,
    signatoryName: branding.signatoryName,
    signatoryTitle: branding.signatoryTitle,
    verifyUrl,
  });
  const stored = await storage().put(`certificates/${cert.certificateId}.pdf`, pdf, 'application/pdf');
  cert.pdfKey = stored.key;
  await cert.save();

  progress.certificateIssued = true;
  await progress.save();

  return cert;
}

export async function verifyCertificate(certificateId: string) {
  const cert = await Certificate.findOne({ certificateId }).lean();
  if (!cert) return { valid: false, status: 'not_found' as const };
  return {
    valid: cert.status === 'issued' || cert.status === 'reissued',
    status: cert.status,
    recipient: maskName(cert.studentName),
    course: cert.courseTitle,
    level: cert.courseLevel,
    institution: cert.institutionName,
    issuedAt: cert.issuedAt,
    completionDate: cert.completionDate,
    revokedAt: cert.revokedAt ?? null,
    revocationReason: cert.status === 'revoked' ? cert.revocationReason ?? null : null,
  };
}

export async function revokeCertificate(certificateId: string, reason: string, revokedBy: string) {
  const cert = await Certificate.findOne({ certificateId });
  if (!cert) throw NotFound('Certificate not found');
  cert.status = 'revoked';
  cert.revokedAt = new Date();
  cert.revocationReason = reason;
  await cert.save();
  await CertificateRevocation.create({
    certificate: cert._id,
    certificateId: cert.certificateId,
    type: 'revocation',
    reason,
    revokedBy,
  });
  return cert;
}

export async function reissueCertificate(certificateId: string, reason: string, revokedBy: string) {
  const old = await Certificate.findOne({ certificateId });
  if (!old) throw NotFound('Certificate not found');
  await revokeCertificate(certificateId, reason, revokedBy);

  const branding = await getBranding();
  const newId = newCertificateId();
  const verifyUrl = `${branding.verifyBaseUrl.replace(/\/$/, '')}/${newId}`;

  const fresh = await Certificate.create({
    certificateId: newId,
    student: old.student,
    studentName: old.studentName,
    enrollment: old.enrollment,
    course: old.course,
    courseVersion: old.courseVersion,
    courseTitle: old.courseTitle,
    courseLevel: old.courseLevel,
    school: old.school,
    institutionName: old.institutionName,
    logoUrl: old.logoUrl,
    signatoryName: old.signatoryName,
    signatoryTitle: old.signatoryTitle,
    signatureUrl: old.signatureUrl,
    sealUrl: old.sealUrl,
    completionDate: old.completionDate,
    issuedAt: new Date(),
    achievementGrade: old.achievementGrade,
    status: 'reissued',
    verifyUrl,
    completionSnapshot: old.completionSnapshot,
    issuedBy: revokedBy,
  });

  const pdf = await generateCertificatePdf({
    studentName: fresh.studentName,
    courseTitle: fresh.courseTitle,
    courseLevel: fresh.courseLevel,
    institutionName: fresh.institutionName,
    completionDate: fresh.completionDate,
    certificateId: fresh.certificateId,
    grade: fresh.achievementGrade,
    signatoryName: branding.signatoryName,
    signatoryTitle: branding.signatoryTitle,
    verifyUrl,
  });
  const stored = await storage().put(`certificates/${fresh.certificateId}.pdf`, pdf, 'application/pdf');
  fresh.pdfKey = stored.key;
  await fresh.save();

  old.supersededBy = fresh._id;
  await old.save();

  await CertificateRevocation.create({
    certificate: old._id,
    certificateId: old.certificateId,
    type: 'reissue',
    reason,
    revokedBy,
    supersededBy: fresh._id,
  });

  return fresh;
}

function gradeFor(percent: number): string {
  if (percent >= 90) return 'Distinction';
  if (percent >= 80) return 'Excellent';
  if (percent >= 70) return 'Very Good';
  if (percent >= 60) return 'Good';
  return 'Pass';
}

function maskName(name: string): string {
  return name
    .split(' ')
    .map((p) => (p.length > 1 ? `${p[0]}${'*'.repeat(Math.max(1, p.length - 2))}${p[p.length - 1]}` : p))
    .join(' ');
}

interface PdfInput {
  studentName: string;
  courseTitle: string;
  courseLevel: string;
  institutionName: string;
  completionDate: Date;
  certificateId: string;
  grade?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  verifyUrl: string;
}

export async function generateCertificatePdf(input: PdfInput): Promise<Buffer> {
  const qr = await QRCode.toBuffer(input.verifyUrl, { type: 'png', margin: 1, width: 160 });

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const orange = '#F97316';
      const charcoal = '#1F2937';

      doc.rect(0, 0, W, H).fill('#FFFFFF');
      doc.lineWidth(14).strokeColor(orange).rect(24, 24, W - 48, H - 48).stroke();
      doc.lineWidth(2).strokeColor('#FED7AA').rect(42, 42, W - 84, H - 84).stroke();

      doc.fillColor(orange).fontSize(16).font('Helvetica-Bold').text(input.institutionName.toUpperCase(), 0, 74, { align: 'center', width: W });
      doc.fillColor(charcoal).fontSize(40).text('Certificate of Completion', 0, 108, { align: 'center', width: W });
      doc.fillColor('#6B7280').fontSize(14).font('Helvetica').text('This certificate is proudly presented to', 0, 172, { align: 'center', width: W });

      doc.fillColor(charcoal).fontSize(34).font('Helvetica-Bold').text(input.studentName, 0, 210, { align: 'center', width: W });
      doc.fillColor('#6B7280').fontSize(14).font('Helvetica').text('for successfully completing all requirements of', 0, 268, { align: 'center', width: W });

      doc.fillColor(charcoal).fontSize(22).font('Helvetica-Bold').text(`${input.courseTitle} (${input.courseLevel})`, 0, 296, { align: 'center', width: W });

      if (input.grade) {
        doc.fillColor(orange).fontSize(14).font('Helvetica-Bold').text(`Achievement: ${input.grade}`, 0, 336, { align: 'center', width: W });
      }

      const dateStr = input.completionDate.toISOString().slice(0, 10);
      doc.fillColor('#6B7280').fontSize(12).font('Helvetica').text(`Completion date: ${dateStr}`, 60, H - 130);
      doc.text(`Certificate ID: ${input.certificateId}`, 60, H - 112);
      doc.fillColor('#9CA3AF').fontSize(10).text('Verify authenticity by scanning the QR code or visiting the verification page.', 60, H - 92);

      if (input.signatoryName) {
        doc.moveTo(W - 300, H - 120).lineTo(W - 90, H - 120).strokeColor('#9CA3AF').lineWidth(1).stroke();
        doc.fillColor(charcoal).fontSize(13).font('Helvetica-Bold').text(input.signatoryName, W - 300, H - 112, { width: 210, align: 'center' });
        if (input.signatoryTitle) {
          doc.fillColor('#6B7280').fontSize(11).font('Helvetica').text(input.signatoryTitle, W - 300, H - 96, { width: 210, align: 'center' });
        }
      }

      doc.image(qr, W - 150, H - 210, { width: 110, height: 110 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
