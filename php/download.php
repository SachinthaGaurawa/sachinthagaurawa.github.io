<?php
// Allowed files mapping (same keys as JS dataset)
$allowedFiles = [
    'cv' => 'docs/Sachintha_Gaurawa_CV.pdf',
    'av-safety-framework' => 'docs/AI_Enhanced_Predictive_Safety_Framework.pdf',
    'drone-disaster-response' => 'docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf'
];

// Get 'file' parameter from GET
$fileKey = isset($_GET['file']) ? $_GET['file'] : '';

if (!array_key_exists($fileKey, $allowedFiles)) {
    http_response_code(404);
    echo "❌ File not found!";
    exit;
}

$filePath = $allowedFiles[$fileKey];

// Security check: ensure the file exists and is under allowed directory
if (!file_exists($filePath) || strpos(realpath($filePath), realpath('docs')) !== 0) {
    http_response_code(404);
    echo "❌ File not found!";
    exit;
}

// Force download headers
header('Content-Description: File Transfer');
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . basename($filePath) . '"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// Clear output buffer
ob_clean();
flush();

// Read the file
readfile($filePath);
exit;
