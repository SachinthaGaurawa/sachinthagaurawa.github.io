<?php
// Map file IDs to actual files
$files = [
    'cv' => 'docs/Sachintha_Gaurawa_CV.pdf',
    'research1' => 'files/Research_01.pdf',
    'research2' => 'files/Research_02.pdf'
];

$fileId = $_GET['file'] ?? '';
if (!isset($files[$fileId])) {
    http_response_code(404);
    echo "File not found";
    exit;
}

$filePath = $files[$fileId];
$fileName = basename($filePath);

// Force download headers
header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// Clear output buffer
flush();
readfile($filePath);
exit;
?>
